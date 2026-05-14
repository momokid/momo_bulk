import { jest } from "@jest/globals";

// Mock axios
jest.unstable_mockModule("axios", () => ({
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

// Mock database pool
jest.unstable_mockModule("../src/config/database.js", () => ({
  default: { query: jest.fn() },
}));

const { default: axios } = await import("axios");
const { default: pool } = await import("../src/config/database.js");
const { encrypt, decrypt } = await import("../src/utils/encryption.js");
const { createAccount, getAllAccounts, deleteAccount } =
  await import("../src/modules/momo/accounts.service.js");

// ─── MTN provisioning mock responses ─────────────────
const mockProvisionSuccess = () => {
  axios.post
    .mockResolvedValueOnce({ status: 201, data: {} }) // create API user
    .mockResolvedValueOnce({ status: 201, data: { apiKey: "mock-api-key" } }); // get API key
};

describe("Accounts Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Create Account ──────────────────────────────────
  describe("createAccount", () => {
    test("provisions with MTN and saves encrypted credentials", async () => {
      // No existing account
      pool.query
        .mockResolvedValueOnce([[]]) // duplicate check
        .mockResolvedValueOnce([{ insertId: 1 }]) // insert
        .mockResolvedValueOnce([
          [
            {
              // getAccountById
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
        label: "Main Agent",
        accountNumber: "0241234567",
        environment: "sandbox",
      });

      // MTN was called twice (create user + get key)
      expect(axios.post).toHaveBeenCalledTimes(2);

      // Credentials saved to DB — verify insert was called
      const insertCall = pool.query.mock.calls[1];
      const insertValues = insertCall[1];

      // api_user and api_key in DB must not be plain text
      expect(insertValues[2]).not.toBe("provisioned-uuid");
      expect(insertValues[3]).not.toBe("mock-api-key");

      // But they must be decryptable
      expect(decrypt(insertValues[2])).toBeDefined();
      expect(decrypt(insertValues[3])).toBeDefined();

      expect(account.id).toBe(1);
    });

    test("throws DUPLICATE_ACCOUNT if number already exists", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // existing account found

      await expect(
        createAccount({
          label: "Duplicate",
          accountNumber: "0241234567",
          environment: "sandbox",
        }),
      ).rejects.toThrow("DUPLICATE_ACCOUNT");

      // MTN should never be called
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  // ── Get All Accounts ────────────────────────────────
  describe("getAllAccounts", () => {
    test("returns list of accounts without credentials", async () => {
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            label: "Main Agent",
            account_number: "0241234567",
            is_active: 1,
          },
          {
            id: 2,
            label: "Second Agent",
            account_number: "0551234567",
            is_active: 1,
          },
        ],
      ]);

      const accounts = await getAllAccounts();
      expect(accounts).toHaveLength(2);
      expect(accounts[0].label).toBe("Main Agent");
    });
  });

  // ── Delete Account ──────────────────────────────────
  describe("deleteAccount", () => {
    test("throws ACCOUNT_IN_USE if account has batches", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 5 }]]); // batch found

      await expect(deleteAccount(1)).rejects.toThrow("ACCOUNT_IN_USE");
    });

    test("deletes account if no batches exist", async () => {
      pool.query
        .mockResolvedValueOnce([[]]) // no batches
        .mockResolvedValueOnce([{}]); // delete query

      await deleteAccount(1);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });
});
