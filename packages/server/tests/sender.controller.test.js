import { jest } from "@jest/globals";
import request from "supertest";

jest.unstable_mockModule(
  "../src/modules/transfers/transfers.service.js",
  () => ({
    resetStuckTransfers: jest.fn(),
    createBatch: jest.fn(),
    getBatchById: jest.fn(),
    getAllBatches: jest.fn(),
    executeSingleTransfer: jest.fn(),
    executeBatch: jest.fn(),
    updateTransfer: jest.fn(),
    deleteTransfer: jest.fn(),
  }),
);

jest.unstable_mockModule("../src/config/database.js", () => ({
  default: { query: jest.fn(), getConnection: jest.fn() },
}));

jest.unstable_mockModule("../src/modules/momo/momo.service.js", () => ({
  verifyAccountName: jest.fn(),
}));

jest.unstable_mockModule("../src/modules/momo/accounts.service.js", () => ({
  getAccountById: jest.fn(),
}));

const { verifyAccountName } =
  await import("../src/modules/momo/momo.service.js");
const { getAccountById } =
  await import("../src/modules/momo/accounts.service.js");
const { default: app } = await import("../src/app.js");

const mockAccount = {
  id: 1,
  label: "Main Agent",
  account_number: "0241234567",
  environment: "sandbox",
  is_active: 1,
};

describe("Sender Verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns name on successful verification", async () => {
    getAccountById.mockResolvedValueOnce(mockAccount);
    verifyAccountName.mockResolvedValueOnce({
      success: true,
      name: "Anwar Sadat",
    });

    const res = await request(app)
      .post("/api/sender/verify")
      .send({ phoneNumber: "0241234567", accountId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Anwar Sadat");
    expect(res.body.phoneNumber).toBe("0241234567");
  });

  test("returns 400 if phone number is missing", async () => {
    const res = await request(app)
      .post("/api/sender/verify")
      .send({ accountId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("returns 400 if phone number format is invalid", async () => {
    const res = await request(app)
      .post("/api/sender/verify")
      .send({ phoneNumber: "12345", accountId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid phone number");
  });

  test("returns 404 if account not found", async () => {
    getAccountById.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/sender/verify")
      .send({ phoneNumber: "0241234567", accountId: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });

  test("returns 400 if account is inactive", async () => {
    getAccountById.mockResolvedValueOnce({ ...mockAccount, is_active: 0 });

    const res = await request(app)
      .post("/api/sender/verify")
      .send({ phoneNumber: "0241234567", accountId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("inactive");
  });

  test("returns 400 if number not registered on MTN", async () => {
    getAccountById.mockResolvedValueOnce(mockAccount);
    verifyAccountName.mockResolvedValueOnce({
      success: false,
      reason: "NOT_FOUND",
    });

    const res = await request(app)
      .post("/api/sender/verify")
      .send({ phoneNumber: "0241234567", accountId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("NOT_FOUND");
  });
});
