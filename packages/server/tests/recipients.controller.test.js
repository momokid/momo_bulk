import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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
  disburse: jest.fn(),
  getTransferStatus: jest.fn(),
  clearTokenCache: jest.fn(),
}));

jest.unstable_mockModule("../src/modules/momo/accounts.service.js", () => ({
  getActiveAccount: jest.fn(),
  getAccountById: jest.fn(),
}));

jest.unstable_mockModule("../src/modules/auth/auth.service.js", () => ({
  register: jest.fn(),
  login: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
  acceptTerms: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

const { verifyAccountName } =
  await import("../src/modules/momo/momo.service.js");
const { getActiveAccount } =
  await import("../src/modules/momo/accounts.service.js");
const { default: app } = await import("../src/app.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validToken = jwt.sign(
  { sub: 1, type: "access" },
  process.env.JWT_SECRET,
  { expiresIn: "2h" },
);
const auth = () => ({ Authorization: `Bearer ${validToken}` });

const mockAccount = {
  id: 1,
  label: "Main Agent",
  account_number: "0201234567",
  environment: "sandbox",
  is_active: 1,
};

// CSV helper — uses agreed friendly column names
const makeCSV = (rows) => {
  const header = "Mobile Number,Full Name,Amount (GHS)\n";
  const body = rows.map((r) => `${r.phone},${r.name},${r.amount}`).join("\n");
  return Buffer.from(header + body);
};

const SAFE_PHONE_1 = "0201234567";
const SAFE_PHONE_2 = "0271234567";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Recipients Controller", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── CSV Parsing ──────────────────────────────────────
  describe("POST /api/recipients/parse-csv", () => {
    test("parses valid CSV and returns recipients", async () => {
      const csv = makeCSV([
        { phone: SAFE_PHONE_1, name: "John Mensah", amount: 500 },
        { phone: SAFE_PHONE_2, name: "Ama Owusu", amount: 200 },
      ]);

      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .set(auth())
        .attach("file", csv, { filename: "test.csv", contentType: "text/csv" });

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.validCount).toBe(2);
      expect(res.body.invalidCount).toBe(0);
      expect(res.body.excludedCount).toBe(0);
      expect(res.body.hasExampleNumbers).toBe(false);
    });

    test("returns 401 without a token", async () => {
      const csv = makeCSV([{ phone: SAFE_PHONE_1, name: "Test", amount: 100 }]);
      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .attach("file", csv, { filename: "test.csv", contentType: "text/csv" });
      expect(res.status).toBe(401);
    });

    test("flags invalid phone number with friendly error message", async () => {
      const csv = makeCSV([
        { phone: "12345", name: "Bad Number", amount: 100 },
        { phone: SAFE_PHONE_1, name: "Good Number", amount: 200 },
      ]);

      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .set(auth())
        .attach("file", csv, { filename: "test.csv", contentType: "text/csv" });

      expect(res.status).toBe(200);
      expect(res.body.validCount).toBe(1);
      expect(res.body.invalidCount).toBe(1);
      expect(res.body.recipients[0].errors[0]).toContain(
        "Mobile Number format is invalid",
      );
      expect(res.body.recipients[0].errors[0]).toContain("Row 1");
    });

    test("flags zero amount with friendly error message", async () => {
      const csv = makeCSV([
        { phone: SAFE_PHONE_1, name: "John Mensah", amount: 0 },
      ]);

      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .set(auth())
        .attach("file", csv, { filename: "test.csv", contentType: "text/csv" });

      expect(res.body.recipients[0].errors[0]).toContain(
        "Amount (GHS) must be a positive number",
      );
    });

    test("marks example numbers as excluded", async () => {
      const csv = makeCSV([
        { phone: "0241234567", name: "Example One", amount: 100 },
        { phone: "0551234567", name: "Example Two", amount: 200 },
        { phone: "0261234567", name: "Example Three", amount: 300 },
        { phone: SAFE_PHONE_1, name: "Real Person", amount: 400 },
      ]);

      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .set(auth())
        .attach("file", csv, { filename: "test.csv", contentType: "text/csv" });

      expect(res.status).toBe(200);
      expect(res.body.hasExampleNumbers).toBe(true);
      expect(res.body.excludedCount).toBe(3);
      expect(res.body.validCount).toBe(1);
    });

    test("excluded rows are not counted in validCount or invalidCount", async () => {
      const csv = makeCSV([
        { phone: "0241234567", name: "Example", amount: 100 },
        { phone: "12345", name: "Bad Phone", amount: 100 },
        { phone: SAFE_PHONE_1, name: "Real Person", amount: 200 },
      ]);

      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .set(auth())
        .attach("file", csv, { filename: "test.csv", contentType: "text/csv" });

      expect(res.body.total).toBe(3);
      expect(res.body.excludedCount).toBe(1);
      expect(res.body.invalidCount).toBe(1);
      expect(res.body.validCount).toBe(1);
    });

    test("returns 400 for empty CSV", async () => {
      const csv = Buffer.from("Mobile Number,Full Name,Amount (GHS)\n");

      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .set(auth())
        .attach("file", csv, { filename: "test.csv", contentType: "text/csv" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("empty");
    });

    test("returns 400 when no file attached", async () => {
      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .set(auth());

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("No file uploaded");
    });
  });

  // ── Name Verification ────────────────────────────────
  describe("POST /api/recipients/verify-names", () => {
    const validRecipients = [
      {
        phone: SAFE_PHONE_1,
        name: "John Mensah",
        amount: 500,
        valid: true,
        excluded: false,
      },
      {
        phone: SAFE_PHONE_2,
        name: "Ama Owusu",
        amount: 200,
        valid: true,
        excluded: false,
      },
    ];

    test("returns verified recipients with match scores", async () => {
      getActiveAccount.mockResolvedValue(mockAccount);
      verifyAccountName
        .mockResolvedValueOnce({ success: true, name: "John Mensah" })
        .mockResolvedValueOnce({ success: true, name: "Owusu Ama" });

      const res = await request(app)
        .post("/api/recipients/verify-names")
        .set(auth())
        .send({ recipients: validRecipients });

      expect(res.status).toBe(200);
      expect(res.body.recipients).toHaveLength(2);
      expect(res.body.recipients[0].matchStatus).toBe("STRONG");
      expect(res.body.recipients[1].matchScore).toBeGreaterThanOrEqual(70);
    });

    test("returns 401 without a token", async () => {
      const res = await request(app)
        .post("/api/recipients/verify-names")
        .send({ recipients: validRecipients });
      expect(res.status).toBe(401);
    });

    test("marks recipient as NOT_FOUND when MTN returns 404", async () => {
      getActiveAccount.mockResolvedValue(mockAccount);
      verifyAccountName.mockResolvedValueOnce({
        success: false,
        reason: "NOT_FOUND",
      });

      const res = await request(app)
        .post("/api/recipients/verify-names")
        .set(auth())
        .send({
          recipients: [
            {
              phone: SAFE_PHONE_1,
              name: "Ghost",
              amount: 100,
              valid: true,
              excluded: false,
            },
          ],
        });

      expect(res.body.recipients[0].matchStatus).toBe("NOT_FOUND");
      expect(res.body.recipients[0].mtnName).toBeNull();
    });

    test("skips MTN call for invalid recipients", async () => {
      getActiveAccount.mockResolvedValue(mockAccount);

      const res = await request(app)
        .post("/api/recipients/verify-names")
        .set(auth())
        .send({
          recipients: [
            {
              phone: "123",
              name: "Bad",
              amount: 0,
              valid: false,
              excluded: false,
              errors: [],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(verifyAccountName).not.toHaveBeenCalled();
      expect(res.body.recipients[0].matchStatus).toBe("INVALID");
    });

    test("skips MTN call for excluded recipients", async () => {
      getActiveAccount.mockResolvedValue(mockAccount);

      const res = await request(app)
        .post("/api/recipients/verify-names")
        .set(auth())
        .send({
          recipients: [
            {
              phone: "0241234567",
              name: "Example",
              amount: 100,
              valid: false,
              excluded: true,
              excludeReason: "EXAMPLE_NUMBER",
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(verifyAccountName).not.toHaveBeenCalled();
      expect(res.body.recipients[0].matchStatus).toBe("EXCLUDED");
    });

    test("returns 400 if no active disbursement account", async () => {
      getActiveAccount.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/recipients/verify-names")
        .set(auth())
        .send({ recipients: validRecipients });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("NO_ACCOUNT");
    });

    test("returns 400 if recipients list is empty", async () => {
      const res = await request(app)
        .post("/api/recipients/verify-names")
        .set(auth())
        .send({ recipients: [] });

      expect(res.status).toBe(400);
    });
  });
});
