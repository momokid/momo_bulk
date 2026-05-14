import { jest } from "@jest/globals";

// Mock axios before importing the service
jest.unstable_mockModule("axios", () => ({
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

const { default: axios } = await import("axios");
const { verifyAccountName, disburse, getTransferStatus, clearTokenCache } =
  await import("../src/modules/momo/momo.service.js");
const { encrypt } = await import("../src/utils/encryption.js");

// ─── Mock account (as it would come from the DB) ─────
const mockAccount = {
  id: 1,
  label: "Test Agent",
  account_number: "0241234567",
  api_user: encrypt("test-api-user-uuid"),
  api_key: encrypt("test-api-key-value"),
  environment: "sandbox",
};

// ─── Mock token response ──────────────────────────────
const mockTokenResponse = {
  data: {
    access_token: "mock-access-token-abc123",
    expires_in: 3600,
  },
};

describe("MoMo Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearTokenCache(mockAccount.id);
  });

  // ── Token ────────────────────────────────────────────
  describe("Token Management", () => {
    test("requests a new token when cache is empty", async () => {
      axios.post.mockResolvedValueOnce(mockTokenResponse);
      axios.get.mockResolvedValueOnce({ data: { name: "John Mensah" } });

      await verifyAccountName(mockAccount, "0241234567");

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/disbursement/token/"),
        {},
        expect.objectContaining({
          headers: expect.objectContaining({
            "Ocp-Apim-Subscription-Key": "test_subscription_key",
          }),
        }),
      );
    });

    test("reuses cached token on second call", async () => {
      axios.post.mockResolvedValue(mockTokenResponse);
      axios.get.mockResolvedValue({ data: { name: "John Mensah" } });

      await verifyAccountName(mockAccount, "0241234567");
      await verifyAccountName(mockAccount, "0241234567");

      // Token should only be requested once
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
  });

  // ── Name Verification ────────────────────────────────
  describe("verifyAccountName", () => {
    test("returns name on success", async () => {
      axios.post.mockResolvedValueOnce(mockTokenResponse);
      axios.get.mockResolvedValueOnce({ data: { name: "Kofi Mensah" } });

      const result = await verifyAccountName(mockAccount, "0241234567");

      expect(result.success).toBe(true);
      expect(result.name).toBe("Kofi Mensah");
    });

    test("returns NOT_FOUND for unregistered number", async () => {
      axios.post.mockResolvedValueOnce(mockTokenResponse);
      axios.get.mockRejectedValueOnce({ response: { status: 404 } });

      const result = await verifyAccountName(mockAccount, "0241234567");

      expect(result.success).toBe(false);
      expect(result.reason).toBe("NOT_FOUND");
    });

    test("returns INVALID_NUMBER for bad phone format", async () => {
      axios.post.mockResolvedValueOnce(mockTokenResponse);
      axios.get.mockRejectedValueOnce({ response: { status: 400 } });

      const result = await verifyAccountName(mockAccount, "123");

      expect(result.success).toBe(false);
      expect(result.reason).toBe("INVALID_NUMBER");
    });
  });

  // ── Disbursement ─────────────────────────────────────
  describe("disburse", () => {
    test("returns referenceId on success", async () => {
      axios.post.mockResolvedValueOnce(mockTokenResponse);
      axios.post.mockResolvedValueOnce({ data: {} });

      const result = await disburse(mockAccount, {
        phone: "0241234567",
        amount: 100,
        externalId: "batch1_0241234567_1234567890",
        payerMessage: "May Salary",
        payeeNote: "May Salary",
      });

      expect(result.success).toBe(true);
      expect(result.referenceId).toBeDefined();
    });

    test("returns failure details on API error", async () => {
      axios.post.mockResolvedValueOnce(mockTokenResponse);
      axios.post.mockRejectedValueOnce({
        response: { status: 500, data: { message: "Internal error" } },
      });

      const result = await disburse(mockAccount, {
        phone: "0241234567",
        amount: 100,
        externalId: "batch1_0241234567_1234567890",
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Internal error");
    });
  });

  // ── Transfer Status ──────────────────────────────────
  describe("getTransferStatus", () => {
    test("returns SUCCESSFUL status", async () => {
      axios.post.mockResolvedValueOnce(mockTokenResponse);
      axios.get.mockResolvedValueOnce({
        data: { status: "SUCCESSFUL", reason: null },
      });

      const result = await getTransferStatus(mockAccount, "some-reference-id");

      expect(result.success).toBe(true);
      expect(result.status).toBe("SUCCESSFUL");
    });

    test("returns FAILED status with reason", async () => {
      axios.post.mockResolvedValueOnce(mockTokenResponse);
      axios.get.mockResolvedValueOnce({
        data: { status: "FAILED", reason: "PAYER_NOT_FOUND" },
      });

      const result = await getTransferStatus(mockAccount, "some-reference-id");

      expect(result.success).toBe(true);
      expect(result.status).toBe("FAILED");
      expect(result.reason).toBe("PAYER_NOT_FOUND");
    });
  });
});
