import { jest } from "@jest/globals";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.unstable_mockModule("axios", () => ({
  default: { post: jest.fn(), get: jest.fn() },
}));

jest.unstable_mockModule("../src/config/database.js", () => ({
  default: { query: jest.fn() },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

const { default: axios } = await import("axios");
const { default: pool } = await import("../src/config/database.js");
const { encrypt, decrypt } = await import("../src/utils/encryption.js");
const { createAccount, getUserAccount, deleteAccount } =
  await import("../src/modules/momo/accounts.service.js");

// ─── MTN provisioning mock ────────────────────────────────────────────────────

const mockProvisionSuccess = () => {
  axios.post
    .mockResolvedValueOnce({ status: 201, data: {} })
    .mockResolvedValueOnce({ status: 201, data: { apiKey: "mock-api-key" } });
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Accounts Service", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── createAccount ───────────────────────────────────
  describe("createAccount", () => {
    test("provisions with MTN and saves encrypted credentials", async () => {
      pool.query
        .mockResolvedValueOnce([[]]) // user account check — none exists
        .mockResolvedValueOnce([[]]) // duplicate number check — none
        .mockResolvedValueOnce([{ insertId: 1 }]) // insert
        .mockResolvedValueOnce([
          // getAccountById
          [
            {
              id: 1,
              label: "Main Agent",
              account_number: "0241234567",
              api_user: encrypt("provisioned-uuid"),
              api_key: encrypt("mock-api-key"),
              environment: "sandbox",
              is_active: 1,
              created_at: new Date(),
            },
          ],
        ]);

      mockProvisionSuccess();

      const account = await createAccount({
        userId: 1,
        label: "Main Agent",
        accountNumber: "0241234567",
        environment: "sandbox",
      });

      // MTN called twice
      expect(axios.post).toHaveBeenCalledTimes(2);

      // Insert is the 3rd query call (index 2)
      const insertCall = pool.query.mock.calls[2];
      const insertValues = insertCall[1];

      // userId is first value
      expect(insertValues[0]).toBe(1);

      // api_user and api_key must not be plain text
      expect(insertValues[3]).not.toBe("provisioned-uuid");
      expect(insertValues[4]).not.toBe("mock-api-key");

      // Must be decryptable
      expect(decrypt(insertValues[3])).toBeDefined();
      expect(decrypt(insertValues[4])).toBeDefined();

      expect(account.id).toBe(1);
    });

    test("throws ACCOUNT_EXISTS if user already has an account", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // user already has account

      await expect(
        createAccount({
          userId: 1,
          label: "Duplicate",
          accountNumber: "0241234567",
          environment: "sandbox",
        }),
      ).rejects.toThrow("ACCOUNT_EXISTS");

      expect(axios.post).not.toHaveBeenCalled();
    });

    test("throws DUPLICATE_ACCOUNT if account number already registered", async () => {
      pool.query
        .mockResolvedValueOnce([[]]) // user account check — none
        .mockResolvedValueOnce([[{ id: 2 }]]); // number already exists globally

      await expect(
        createAccount({
          userId: 1,
          label: "Dup Number",
          accountNumber: "0241234567",
          environment: "sandbox",
        }),
      ).rejects.toThrow("DUPLICATE_ACCOUNT");

      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  // ── getUserAccount ──────────────────────────────────
  describe("getUserAccount", () => {
    test("returns the user's account without credentials", async () => {
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            label: "Main Agent",
            account_number: "0241234567",
            is_active: 1,
          },
        ],
      ]);

      const account = await getUserAccount(1);

      expect(account.label).toBe("Main Agent");
      expect(account.api_user).toBeUndefined(); // credentials not returned
    });

    test("returns null if user has no account", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const account = await getUserAccount(1);

      expect(account).toBeNull();
    });
  });

  // ── deleteAccount ───────────────────────────────────
  describe("deleteAccount", () => {
    test("throws ACCOUNT_IN_USE if account has batches", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 5 }]]); // batch found

      await expect(deleteAccount(1, 1)).rejects.toThrow("ACCOUNT_IN_USE");
    });

    test("deletes account if no batches exist", async () => {
      pool.query
        .mockResolvedValueOnce([[]]) // no batches
        .mockResolvedValueOnce([{}]); // delete

      await deleteAccount(1, 1);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });
});
