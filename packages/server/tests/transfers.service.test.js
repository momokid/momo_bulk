import { jest } from "@jest/globals";

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

const { default: pool } = await import("../src/config/database.js");
const { disburse } = await import("../src/modules/momo/momo.service.js");
const { getAccountById } =
  await import("../src/modules/momo/accounts.service.js");
const {
  createBatch,
  getBatchById,
  executeSingleTransfer,
  resetStuckTransfers,
  updateTransfer,
  deleteTransfer,
} = await import("../src/modules/transfers/transfers.service.js");

// ─── Mock account ─────────────────────────────────────
const mockAccount = {
  id: 1,
  label: "Main Agent",
  account_number: "0241234567",
  environment: "sandbox",
  is_active: 1,
};

// ─── Mock connection for transactions ─────────────────
const mockConnection = {
  beginTransaction: jest.fn(),
  query: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};

describe("Transfers Service", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Reset Stuck Transfers ────────────────────────
  describe("resetStuckTransfers", () => {
    test("resets processing transfers to pending on startup", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 2 }]);
      await resetStuckTransfers();
    });
  });

  // ── Create Batch ─────────────────────────────────
  describe("createBatch", () => {
    test("creates batch and inserts eligible transfers only", async () => {
      pool.getConnection.mockResolvedValueOnce(mockConnection);
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 1 }]) // insert batch
        .mockResolvedValueOnce([{}]) // insert transfer 1
        .mockResolvedValueOnce([{}]); // insert transfer 2

      // getBatchById after creation
      pool.query
        .mockResolvedValueOnce([[{ id: 1, reference: "May Salary" }]])
        .mockResolvedValueOnce([
          [
            { id: 1, status: "pending" },
            { id: 2, status: "pending" },
          ],
        ]);

      const batch = await createBatch({
        username: "0241234567",
        reference: "May Salary",
        senderNumber: "0241234567",
        senderName: "Anwar Sadat",
        momoAccountId: 1,
        recipients: [
          {
            phone: "0551234567",
            name: "Kofi",
            amount: 100,
            valid: true,
            matchStatus: "STRONG",
            mtnName: "Kofi Mensah",
            matchScore: 95,
          },
          {
            phone: "0261234567",
            name: "Ama",
            amount: 200,
            valid: true,
            matchStatus: "LIKELY",
            mtnName: "Ama Owusu",
            matchScore: 75,
          },
          {
            phone: "123",
            name: "Bad",
            amount: 0,
            valid: false,
            matchStatus: "INVALID",
          },
        ],
      });

      // Only 2 eligible recipients inserted (invalid one skipped)
      const insertCalls = mockConnection.query.mock.calls.filter((c) =>
        c[0].toString().includes("INSERT INTO transfers"),
      );
      expect(insertCalls).toHaveLength(2);
      expect(batch).toBeDefined();
    });
  });

  // ── Execute Single Transfer ───────────────────────
  describe("executeSingleTransfer", () => {
    test("marks transfer as success and saves MTN reference", async () => {
      pool.query
        .mockResolvedValueOnce([
          [
            {
              // fetch transfer
              id: 1,
              status: "pending",
              recipient_phone: "0551234567",
              amount: 100,
              external_id: "batch1_0551234567_123",
              momo_account_id: 1,
              reference: "May Salary",
              batch_id: 1,
            },
          ],
        ])
        .mockResolvedValueOnce([{}]) // set processing
        .mockResolvedValueOnce([{}]); // set success

      getAccountById.mockResolvedValueOnce(mockAccount);
      disburse.mockResolvedValueOnce({
        success: true,
        referenceId: "mtn-ref-abc",
      });

      const result = await executeSingleTransfer(1, 1);

      expect(result.status).toBe("success");
      expect(result.referenceId).toBe("mtn-ref-abc");

      // Confirm success update was called
      const successCall = pool.query.mock.calls.find((c) =>
        c[0].toString().includes("status = 'success'"),
      );
      expect(successCall).toBeDefined();
      expect(successCall[1]).toContain("mtn-ref-abc");
    });

    test("marks transfer as failed and saves failure reason", async () => {
      pool.query
        .mockResolvedValueOnce([
          [
            {
              id: 2,
              status: "pending",
              recipient_phone: "0201234567",
              amount: 50,
              external_id: "batch1_0201234567_456",
              momo_account_id: 1,
              batch_id: 1,
            },
          ],
        ])
        .mockResolvedValueOnce([{}]) // set processing
        .mockResolvedValueOnce([{}]); // set failed

      getAccountById.mockResolvedValueOnce(mockAccount);
      disburse.mockResolvedValueOnce({
        success: false,
        message: "PAYER_NOT_FOUND",
      });

      const result = await executeSingleTransfer(2, 1);

      expect(result.status).toBe("failed");
      expect(result.reason).toBe("PAYER_NOT_FOUND");
    });

    test("throws ALREADY_PAID for successful transfer", async () => {
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 3,
            status: "success",
            momo_account_id: 1,
            batch_id: 1,
          },
        ],
      ]);

      await expect(executeSingleTransfer(3, 1)).rejects.toThrow("ALREADY_PAID");
      expect(disburse).not.toHaveBeenCalled();
    });

    test("throws TRANSFER_NOT_FOUND for missing transfer", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(executeSingleTransfer(999, 1)).rejects.toThrow(
        "TRANSFER_NOT_FOUND",
      );
    });
  });

  // ── Update Transfer ───────────────────────────────
  describe("updateTransfer", () => {
    test("updates amount and name for pending transfer", async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 1, status: "pending" }]])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([[{ id: 1, amount: 300, status: "pending" }]]);

      const result = await updateTransfer(1, {
        amount: 300,
        recipientNameInput: "Kofi Mensah",
      });
      expect(result.amount).toBe(300);
    });

    test("throws TRANSFER_NOT_EDITABLE for non-pending transfer", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1, status: "success" }]]);
      await expect(updateTransfer(1, { amount: 100 })).rejects.toThrow(
        "TRANSFER_NOT_EDITABLE",
      );
    });
  });

  // ── Delete Transfer ───────────────────────────────
  describe("deleteTransfer", () => {
    test("deletes a pending transfer", async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 1, status: "pending" }]])
        .mockResolvedValueOnce([{}]);

      await deleteTransfer(1);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test("throws TRANSFER_NOT_DELETABLE for non-pending transfer", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1, status: "success" }]]);
      await expect(deleteTransfer(1)).rejects.toThrow("TRANSFER_NOT_DELETABLE");
    });
  });
});
