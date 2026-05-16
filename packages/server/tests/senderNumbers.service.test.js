import { jest } from "@jest/globals";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.unstable_mockModule("../src/config/database.js", () => ({
  default: { query: jest.fn(), getConnection: jest.fn() },
}));

jest.unstable_mockModule("../src/modules/momo/momo.service.js", () => ({
  verifyAccountName: jest.fn(),
  disburse: jest.fn(),
  getTransferStatus: jest.fn(),
  clearTokenCache: jest.fn(),
}));

jest.unstable_mockModule("../src/modules/momo/accounts.service.js", () => ({
  getAccountById: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

const { default: pool } = await import("../src/config/database.js");
const { verifyAccountName } =
  await import("../src/modules/momo/momo.service.js");
const { getAccountById } =
  await import("../src/modules/momo/accounts.service.js");
const {
  addSenderNumber,
  getSenderNumbers,
  setDefault,
  updateLabel,
  toggleActive,
  deleteSenderNumber,
} = await import("../src/modules/senderNumbers/senderNumbers.service.js");

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const mockAccount = {
  id: 1,
  label: "Main Agent",
  account_number: "0241234567",
  is_active: 1,
};

const mockNumber = {
  id: 1,
  phone_number: "0551234567",
  label: "My MoMo",
  mtn_name: "Kofi Mensah",
  is_default: 1,
  is_active: 1,
  created_at: new Date(),
};

const mockConnection = {
  beginTransaction: jest.fn(),
  query: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SenderNumbers Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── addSenderNumber ────────────────────────────────
  describe("addSenderNumber", () => {
    test("adds first number and sets it as default", async () => {
      pool.query
        .mockResolvedValueOnce([[]]) // duplicate check
        .mockResolvedValueOnce([[{ total: 0 }]]) // count — first number
        .mockResolvedValueOnce([{ insertId: 1 }]) // insert
        .mockResolvedValueOnce([[mockNumber]]); // getSenderNumberById

      getAccountById.mockResolvedValueOnce(mockAccount);
      verifyAccountName.mockResolvedValueOnce({
        success: true,
        name: "Kofi Mensah",
      });

      const result = await addSenderNumber(1, "0551234567", "My MoMo", 1);

      expect(result.id).toBe(1);
      expect(result.mtn_name).toBe("Kofi Mensah");

      // is_default = 1 passed to insert
      const insertArgs = pool.query.mock.calls[2][1];
      expect(insertArgs[4]).toBe(1);
    });

    test("adds subsequent number without setting it as default", async () => {
      pool.query
        .mockResolvedValueOnce([[]]) // duplicate check
        .mockResolvedValueOnce([[{ total: 2 }]]) // count — not first
        .mockResolvedValueOnce([{ insertId: 2 }]) // insert
        .mockResolvedValueOnce([[{ ...mockNumber, id: 2, is_default: 0 }]]);

      getAccountById.mockResolvedValueOnce(mockAccount);
      verifyAccountName.mockResolvedValueOnce({
        success: true,
        name: "Ama Owusu",
      });

      await addSenderNumber(1, "0201234567", "Second Number", 1);

      const insertArgs = pool.query.mock.calls[2][1];
      expect(insertArgs[4]).toBe(0); // is_default = 0
    });

    test("throws 400 for invalid phone number format", async () => {
      await expect(
        addSenderNumber(1, "12345", "My MoMo", 1),
      ).rejects.toMatchObject({ status: 400 });

      expect(pool.query).not.toHaveBeenCalled();
    });

    test("throws 400 if label is missing", async () => {
      await expect(
        addSenderNumber(1, "0551234567", "", 1),
      ).rejects.toMatchObject({ status: 400 });

      expect(pool.query).not.toHaveBeenCalled();
    });

    test("throws 400 if accountId is missing", async () => {
      await expect(
        addSenderNumber(1, "0551234567", "My MoMo", null),
      ).rejects.toMatchObject({ status: 400 });

      expect(pool.query).not.toHaveBeenCalled();
    });

    test("throws 409 if number already exists for user", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // duplicate found

      await expect(
        addSenderNumber(1, "0551234567", "My MoMo", 1),
      ).rejects.toMatchObject({ status: 409, code: "DUPLICATE_NUMBER" });

      expect(getAccountById).not.toHaveBeenCalled();
    });

    test("throws 404 if disbursement account not found", async () => {
      pool.query.mockResolvedValueOnce([[]]); // no duplicate
      getAccountById.mockResolvedValueOnce(null);

      await expect(
        addSenderNumber(1, "0551234567", "My MoMo", 999),
      ).rejects.toMatchObject({ status: 404, code: "ACCOUNT_NOT_FOUND" });

      expect(verifyAccountName).not.toHaveBeenCalled();
    });

    test("throws 400 if disbursement account is inactive", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      getAccountById.mockResolvedValueOnce({ ...mockAccount, is_active: 0 });

      await expect(
        addSenderNumber(1, "0551234567", "My MoMo", 1),
      ).rejects.toMatchObject({ status: 400, code: "ACCOUNT_INACTIVE" });

      expect(verifyAccountName).not.toHaveBeenCalled();
    });

    test("throws 400 if number is not registered on MTN", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      getAccountById.mockResolvedValueOnce(mockAccount);
      verifyAccountName.mockResolvedValueOnce({
        success: false,
        reason: "NOT_FOUND",
      });

      await expect(
        addSenderNumber(1, "0551234567", "My MoMo", 1),
      ).rejects.toMatchObject({ status: 400, code: "NOT_FOUND" });
    });
  });

  // ── getSenderNumbers ────────────────────────────────
  describe("getSenderNumbers", () => {
    test("returns all numbers for user ordered by default first", async () => {
      pool.query.mockResolvedValueOnce([
        [
          { ...mockNumber, is_default: 1 },
          { ...mockNumber, id: 2, is_default: 0 },
        ],
      ]);

      const result = await getSenderNumbers(1);

      expect(result).toHaveLength(2);
      expect(result[0].is_default).toBe(1);
    });

    test("returns empty array if user has no numbers", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const result = await getSenderNumbers(1);

      expect(result).toHaveLength(0);
    });
  });

  // ── setDefault ─────────────────────────────────────
  describe("setDefault", () => {
    test("clears old default and sets new one in a transaction", async () => {
      pool.query
        .mockResolvedValueOnce([[mockNumber]]) // getSenderNumberById (ownership)
        .mockResolvedValueOnce([[mockNumber]]); // getSenderNumberById (return)

      pool.getConnection.mockResolvedValueOnce(mockConnection);
      mockConnection.query
        .mockResolvedValueOnce([{}]) // clear defaults
        .mockResolvedValueOnce([{}]); // set new default

      const result = await setDefault(1, 1);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test("throws 404 if number does not belong to user", async () => {
      pool.query.mockResolvedValueOnce([[]]); // not found

      await expect(setDefault(1, 999)).rejects.toMatchObject({
        status: 404,
        code: "NUMBER_NOT_FOUND",
      });

      expect(pool.getConnection).not.toHaveBeenCalled();
    });
  });

  // ── updateLabel ─────────────────────────────────────
  describe("updateLabel", () => {
    test("updates label and returns updated number", async () => {
      pool.query
        .mockResolvedValueOnce([[mockNumber]]) // ownership check
        .mockResolvedValueOnce([{}]) // update
        .mockResolvedValueOnce([[{ ...mockNumber, label: "New Label" }]]); // return

      const result = await updateLabel(1, 1, "New Label");

      expect(result.label).toBe("New Label");
    });

    test("throws 400 if label is empty", async () => {
      await expect(updateLabel(1, 1, "")).rejects.toMatchObject({
        status: 400,
      });

      expect(pool.query).not.toHaveBeenCalled();
    });

    test("throws 404 if number not found", async () => {
      pool.query.mockResolvedValueOnce([[]]); // not found

      await expect(updateLabel(1, 999, "Label")).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  // ── toggleActive ────────────────────────────────────
  describe("toggleActive", () => {
    test("toggles is_active and returns updated number", async () => {
      pool.query
        .mockResolvedValueOnce([[mockNumber]]) // ownership
        .mockResolvedValueOnce([{}]) // toggle
        .mockResolvedValueOnce([[{ ...mockNumber, is_active: 0 }]]); // return

      const result = await toggleActive(1, 1);

      expect(result.is_active).toBe(0);
    });

    test("throws 404 if number not found", async () => {
      pool.query.mockResolvedValueOnce([[]]); // not found

      await expect(toggleActive(1, 999)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  // ── deleteSenderNumber ──────────────────────────────
  describe("deleteSenderNumber", () => {
    test("deletes a number not used in any batch", async () => {
      pool.query
        .mockResolvedValueOnce([[mockNumber]]) // ownership
        .mockResolvedValueOnce([[]]) // no batches
        .mockResolvedValueOnce([{}]); // delete

      await deleteSenderNumber(1, 1);

      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    test("throws 404 if number not found", async () => {
      pool.query.mockResolvedValueOnce([[]]); // not found

      await expect(deleteSenderNumber(1, 999)).rejects.toMatchObject({
        status: 404,
      });
    });

    test("throws 409 if number has been used in a batch", async () => {
      pool.query
        .mockResolvedValueOnce([[mockNumber]]) // ownership
        .mockResolvedValueOnce([[{ id: 5 }]]); // batch found

      await expect(deleteSenderNumber(1, 1)).rejects.toMatchObject({
        status: 409,
        code: "NUMBER_IN_USE",
      });

      // Delete query must not be called
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });
});
