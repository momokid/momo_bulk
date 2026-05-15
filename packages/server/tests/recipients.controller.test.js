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

// ─── Helper: build CSV buffer ─────────────────────────
const makeCSV = (rows) => {
  const header = "phone,amount,name\n";
  const body = rows.map((r) => `${r.phone},${r.amount},${r.name}`).join("\n");
  return Buffer.from(header + body);
};

describe("Recipients Controller", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── CSV Parsing ──────────────────────────────────
  describe("POST /api/recipients/parse-csv", () => {
    test("parses valid CSV and returns recipients", async () => {
      const csv = makeCSV([
        { phone: "0241234567", amount: 500, name: "John Mensah" },
        { phone: "0551234567", amount: 200, name: "Ama Owusu" },
      ]);

      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .attach("file", csv, { filename: "test.csv", contentType: "text/csv" });

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.validCount).toBe(2);
      expect(res.body.invalidCount).toBe(0);
    });

    test("flags invalid phone number", async () => {
      const csv = makeCSV([
        { phone: "12345", amount: 100, name: "Bad Number" },
        { phone: "0241234567", amount: 200, name: "Good Number" },
      ]);

      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .attach("file", csv, { filename: "test.csv", contentType: "text/csv" });

      expect(res.status).toBe(200);
      expect(res.body.validCount).toBe(1);
      expect(res.body.invalidCount).toBe(1);
      expect(res.body.recipients[0].errors).toContain(
        "Invalid phone number format",
      );
    });

    test("flags zero amount", async () => {
      const csv = makeCSV([
        { phone: "0241234567", amount: 0, name: "John Mensah" },
      ]);

      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .attach("file", csv, { filename: "test.csv", contentType: "text/csv" });

      expect(res.body.recipients[0].errors).toContain(
        "Amount must be a positive number",
      );
    });

    test("returns 400 for empty CSV", async () => {
      const csv = Buffer.from("phone,amount,name\n");

      const res = await request(app)
        .post("/api/recipients/parse-csv")
        .attach("file", csv, { filename: "test.csv", contentType: "text/csv" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("empty");
    });

    test("returns 400 when no file attached", async () => {
      const res = await request(app).post("/api/recipients/parse-csv");

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("No file uploaded");
    });
  });

  // ── Name Verification ────────────────────────────
  describe("POST /api/recipients/verify-names", () => {
    const validRecipients = [
      { phone: "0241234567", name: "John Mensah", amount: 500, valid: true },
      { phone: "0551234567", name: "Ama Owusu", amount: 200, valid: true },
    ];

    test("returns verified recipients with match scores", async () => {
      getAccountById.mockResolvedValue(mockAccount);
      verifyAccountName
        .mockResolvedValueOnce({ success: true, name: "John Mensah" })
        .mockResolvedValueOnce({ success: true, name: "Owusu Ama" });

      const res = await request(app)
        .post("/api/recipients/verify-names")
        .send({ recipients: validRecipients, accountId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.recipients).toHaveLength(2);
      expect(res.body.recipients[0].matchStatus).toBe("STRONG");
      expect(res.body.recipients[0].mtnName).toBe("John Mensah");
      // Flipped name still matches
      expect(res.body.recipients[1].matchScore).toBeGreaterThanOrEqual(70);
    });

    test("marks recipient as NOT_FOUND when MTN returns 404", async () => {
      getAccountById.mockResolvedValue(mockAccount);
      verifyAccountName.mockResolvedValueOnce({
        success: false,
        reason: "NOT_FOUND",
      });

      const res = await request(app)
        .post("/api/recipients/verify-names")
        .send({
          recipients: [
            {
              phone: "0241234567",
              name: "Ghost User",
              amount: 100,
              valid: true,
            },
          ],
          accountId: 1,
        });

      expect(res.body.recipients[0].matchStatus).toBe("NOT_FOUND");
      expect(res.body.recipients[0].mtnName).toBeNull();
    });

    test("skips MTN call for invalid recipients", async () => {
      getAccountById.mockResolvedValue(mockAccount);

      const res = await request(app)
        .post("/api/recipients/verify-names")
        .send({
          recipients: [
            {
              phone: "123",
              name: "Bad",
              amount: 0,
              valid: false,
              errors: ["Invalid phone"],
            },
          ],
          accountId: 1,
        });

      expect(res.status).toBe(200);
      expect(verifyAccountName).not.toHaveBeenCalled();
      expect(res.body.recipients[0].matchStatus).toBe("INVALID");
    });

    test("returns 400 if recipients list is empty", async () => {
      const res = await request(app)
        .post("/api/recipients/verify-names")
        .send({ recipients: [], accountId: 1 });

      expect(res.status).toBe(400);
    });

    test("returns 404 if account not found", async () => {
      getAccountById.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/recipients/verify-names")
        .send({ recipients: validRecipients, accountId: 999 });

      expect(res.status).toBe(404);
    });
  });
});
