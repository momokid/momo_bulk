import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.unstable_mockModule(
  "../src/modules/senderNumbers/senderNumbers.service.js",
  () => ({
    addSenderNumber: jest.fn(),
    getSenderNumbers: jest.fn(),
    getSenderNumberById: jest.fn(),
    setDefault: jest.fn(),
    updateLabel: jest.fn(),
    toggleActive: jest.fn(),
    deleteSenderNumber: jest.fn(),
  }),
);

jest.unstable_mockModule("../src/modules/auth/auth.service.js", () => ({
  register: jest.fn(),
  login: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
  acceptTerms: jest.fn(),
}));

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

// ─── Imports (after mocks) ────────────────────────────────────────────────────

const senderNumbersService =
  await import("../src/modules/senderNumbers/senderNumbers.service.js");
const { default: app } = await import("../src/app.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validToken = jwt.sign(
  { sub: 1, type: "access" },
  process.env.JWT_SECRET,
  { expiresIn: "2h" },
);

const auth = () => ({ Authorization: `Bearer ${validToken}` });

const mockNumber = {
  id: 1,
  phone_number: "0551234567",
  label: "My MoMo",
  mtn_name: "Kofi Mensah",
  is_default: 1,
  is_active: 1,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SenderNumbers Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/sender-numbers ────────────────────────
  describe("POST /api/sender-numbers", () => {
    test("returns 201 with senderNumber on success", async () => {
      senderNumbersService.addSenderNumber.mockResolvedValueOnce(mockNumber);

      const res = await request(app)
        .post("/api/sender-numbers")
        .set(auth())
        .send({ phoneNumber: "0551234567", label: "My MoMo", accountId: 1 });

      expect(res.status).toBe(201);
      expect(res.body.senderNumber.phone_number).toBe("0551234567");
      expect(res.body.senderNumber.mtn_name).toBe("Kofi Mensah");
    });

    test("returns 401 without a token", async () => {
      const res = await request(app)
        .post("/api/sender-numbers")
        .send({ phoneNumber: "0551234567", label: "My MoMo", accountId: 1 });

      expect(res.status).toBe(401);
    });

    test("returns 400 on invalid phone number", async () => {
      senderNumbersService.addSenderNumber.mockRejectedValueOnce(
        Object.assign(new Error("Invalid phone number."), { status: 400 }),
      );

      const res = await request(app)
        .post("/api/sender-numbers")
        .set(auth())
        .send({ phoneNumber: "12345", label: "My MoMo", accountId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test("returns 409 on duplicate number", async () => {
      senderNumbersService.addSenderNumber.mockRejectedValueOnce(
        Object.assign(
          new Error("This number is already saved to your account."),
          { status: 409, code: "DUPLICATE_NUMBER" },
        ),
      );

      const res = await request(app)
        .post("/api/sender-numbers")
        .set(auth())
        .send({ phoneNumber: "0551234567", label: "My MoMo", accountId: 1 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("DUPLICATE_NUMBER");
    });

    test("returns 500 on unexpected error", async () => {
      senderNumbersService.addSenderNumber.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const res = await request(app)
        .post("/api/sender-numbers")
        .set(auth())
        .send({ phoneNumber: "0551234567", label: "My MoMo", accountId: 1 });

      expect(res.status).toBe(500);
    });
  });

  // ── GET /api/sender-numbers ─────────────────────────
  describe("GET /api/sender-numbers", () => {
    test("returns 200 with senderNumbers array", async () => {
      senderNumbersService.getSenderNumbers.mockResolvedValueOnce([
        mockNumber,
        { ...mockNumber, id: 2, is_default: 0 },
      ]);

      const res = await request(app).get("/api/sender-numbers").set(auth());

      expect(res.status).toBe(200);
      expect(res.body.senderNumbers).toHaveLength(2);
    });

    test("returns 401 without a token", async () => {
      const res = await request(app).get("/api/sender-numbers");
      expect(res.status).toBe(401);
    });

    test("returns empty array if user has no numbers", async () => {
      senderNumbersService.getSenderNumbers.mockResolvedValueOnce([]);

      const res = await request(app).get("/api/sender-numbers").set(auth());

      expect(res.status).toBe(200);
      expect(res.body.senderNumbers).toHaveLength(0);
    });
  });

  // ── PATCH /api/sender-numbers/:id/default ───────────
  describe("PATCH /api/sender-numbers/:id/default", () => {
    test("returns 200 on success", async () => {
      senderNumbersService.setDefault.mockResolvedValueOnce({
        ...mockNumber,
        is_default: 1,
      });

      const res = await request(app)
        .patch("/api/sender-numbers/1/default")
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body.senderNumber.is_default).toBe(1);
    });

    test("returns 401 without a token", async () => {
      const res = await request(app).patch("/api/sender-numbers/1/default");
      expect(res.status).toBe(401);
    });

    test("returns 404 if number not found", async () => {
      senderNumbersService.setDefault.mockRejectedValueOnce(
        Object.assign(new Error("Sender number not found."), { status: 404 }),
      );

      const res = await request(app)
        .patch("/api/sender-numbers/999/default")
        .set(auth());

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/sender-numbers/:id/label ─────────────
  describe("PATCH /api/sender-numbers/:id/label", () => {
    test("returns 200 with updated label", async () => {
      senderNumbersService.updateLabel.mockResolvedValueOnce({
        ...mockNumber,
        label: "Work MoMo",
      });

      const res = await request(app)
        .patch("/api/sender-numbers/1/label")
        .set(auth())
        .send({ label: "Work MoMo" });

      expect(res.status).toBe(200);
      expect(res.body.senderNumber.label).toBe("Work MoMo");
    });

    test("returns 401 without a token", async () => {
      const res = await request(app)
        .patch("/api/sender-numbers/1/label")
        .send({ label: "Work MoMo" });

      expect(res.status).toBe(401);
    });

    test("returns 400 if label is empty", async () => {
      senderNumbersService.updateLabel.mockRejectedValueOnce(
        Object.assign(new Error("Label is required."), { status: 400 }),
      );

      const res = await request(app)
        .patch("/api/sender-numbers/1/label")
        .set(auth())
        .send({ label: "" });

      expect(res.status).toBe(400);
    });

    test("returns 404 if number not found", async () => {
      senderNumbersService.updateLabel.mockRejectedValueOnce(
        Object.assign(new Error("Sender number not found."), { status: 404 }),
      );

      const res = await request(app)
        .patch("/api/sender-numbers/999/label")
        .set(auth())
        .send({ label: "Test" });

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/sender-numbers/:id/toggle ────────────
  describe("PATCH /api/sender-numbers/:id/toggle", () => {
    test("returns 200 with toggled status", async () => {
      senderNumbersService.toggleActive.mockResolvedValueOnce({
        ...mockNumber,
        is_active: 0,
      });

      const res = await request(app)
        .patch("/api/sender-numbers/1/toggle")
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body.senderNumber.is_active).toBe(0);
      expect(res.body.message).toContain("deactivated");
    });

    test("returns 401 without a token", async () => {
      const res = await request(app).patch("/api/sender-numbers/1/toggle");
      expect(res.status).toBe(401);
    });

    test("returns 404 if number not found", async () => {
      senderNumbersService.toggleActive.mockRejectedValueOnce(
        Object.assign(new Error("Sender number not found."), { status: 404 }),
      );

      const res = await request(app)
        .patch("/api/sender-numbers/999/toggle")
        .set(auth());

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/sender-numbers/:id ──────────────────
  describe("DELETE /api/sender-numbers/:id", () => {
    test("returns 200 on successful delete", async () => {
      senderNumbersService.deleteSenderNumber.mockResolvedValueOnce();

      const res = await request(app)
        .delete("/api/sender-numbers/1")
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("deleted");
    });

    test("returns 401 without a token", async () => {
      const res = await request(app).delete("/api/sender-numbers/1");
      expect(res.status).toBe(401);
    });

    test("returns 404 if number not found", async () => {
      senderNumbersService.deleteSenderNumber.mockRejectedValueOnce(
        Object.assign(new Error("Sender number not found."), { status: 404 }),
      );

      const res = await request(app)
        .delete("/api/sender-numbers/999")
        .set(auth());

      expect(res.status).toBe(404);
    });

    test("returns 409 if number is used in a batch", async () => {
      senderNumbersService.deleteSenderNumber.mockRejectedValueOnce(
        Object.assign(
          new Error("Cannot delete a number that has been used in a batch."),
          { status: 409 },
        ),
      );

      const res = await request(app)
        .delete("/api/sender-numbers/1")
        .set(auth());

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("batch");
    });
  });
});
