import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

const authService = await import("../src/modules/auth/auth.service.js");
const { default: app } = await import("../src/app.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Generate a real token signed with the test secret from setup.js
// The authenticate middleware will verify this successfully
const validAccessToken = jwt.sign(
  { sub: 1, type: "access" },
  process.env.JWT_SECRET,
  { expiresIn: "2h" },
);

const mockUser = {
  id: 1,
  email: "test@example.com",
  termsAcceptedAt: new Date().toISOString(),
};

const mockTokens = {
  accessToken: "mock-access-token",
  refreshToken: "mock-refresh-token",
  user: mockUser,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Auth Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/auth/register ────────────────────────
  describe("POST /api/auth/register", () => {
    test("returns 201 with accessToken and sets cookie on success", async () => {
      authService.register.mockResolvedValueOnce(mockTokens);

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@example.com", password: "password123" });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBe("mock-access-token");
      expect(res.body.user.email).toBe("test@example.com");

      // Refresh token must be in httpOnly cookie
      expect(res.headers["set-cookie"]).toBeDefined();
      expect(res.headers["set-cookie"][0]).toContain("refreshToken=");
    });

    test("returns 400 if email is missing", async () => {
      authService.register.mockRejectedValueOnce(
        Object.assign(new Error("Email and password are required."), {
          status: 400,
        }),
      );

      const res = await request(app)
        .post("/api/auth/register")
        .send({ password: "password123" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test("returns 409 if email already exists", async () => {
      authService.register.mockRejectedValueOnce(
        Object.assign(new Error("An account with this email already exists."), {
          status: 409,
        }),
      );

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@example.com", password: "password123" });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("already exists");
    });

    test("returns 500 on unexpected error", async () => {
      authService.register.mockRejectedValueOnce(
        new Error("DB connection lost"),
      );

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@example.com", password: "password123" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });
  });

  // ── POST /api/auth/login ───────────────────────────
  describe("POST /api/auth/login", () => {
    test("returns 200 with accessToken and sets cookie on success", async () => {
      authService.login.mockResolvedValueOnce(mockTokens);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBe("mock-access-token");
      expect(res.body.user).toHaveProperty("termsAcceptedAt");

      expect(res.headers["set-cookie"]).toBeDefined();
      expect(res.headers["set-cookie"][0]).toContain("refreshToken=");
    });

    test("returns 401 on invalid credentials", async () => {
      authService.login.mockRejectedValueOnce(
        Object.assign(new Error("Invalid email or password."), { status: 401 }),
      );

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test("returns 403 if account is deactivated", async () => {
      authService.login.mockRejectedValueOnce(
        Object.assign(new Error("This account has been deactivated."), {
          status: 403,
        }),
      );

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "password123" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("deactivated");
    });

    test("returns 400 if password is missing", async () => {
      authService.login.mockRejectedValueOnce(
        Object.assign(new Error("Email and password are required."), {
          status: 400,
        }),
      );

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/auth/refresh ─────────────────────────
  describe("POST /api/auth/refresh", () => {
    test("returns 200 with new accessToken when cookie is present", async () => {
      authService.refreshToken.mockResolvedValueOnce({
        accessToken: "new-access-token",
      });

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", "refreshToken=valid-refresh-token");

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBe("new-access-token");
    });

    test("returns 401 when refresh token is missing", async () => {
      authService.refreshToken.mockRejectedValueOnce(
        Object.assign(new Error("Refresh token missing."), { status: 401 }),
      );

      const res = await request(app).post("/api/auth/refresh");

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test("returns 401 when refresh token is invalid", async () => {
      authService.refreshToken.mockRejectedValueOnce(
        Object.assign(new Error("Invalid or expired refresh token."), {
          status: 401,
        }),
      );

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", "refreshToken=bad-token");

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/auth/logout ──────────────────────────
  describe("POST /api/auth/logout", () => {
    test("returns 200 and clears the refresh token cookie", async () => {
      authService.logout.mockResolvedValueOnce({ success: true });

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", "refreshToken=some-token");

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("Logged out");

      // Cookie should be cleared (Expires set to epoch)
      expect(res.headers["set-cookie"]).toBeDefined();
      expect(res.headers["set-cookie"][0]).toContain("refreshToken=;");
    });
  });

  // ── POST /api/auth/accept-terms ────────────────────
  describe("POST /api/auth/accept-terms", () => {
    test("returns 401 without a valid token", async () => {
      const res = await request(app).post("/api/auth/accept-terms");

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test("returns 200 with valid token and stamps terms", async () => {
      authService.acceptTerms.mockResolvedValueOnce({
        accepted: true,
        version: "1.0",
        acceptedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post("/api/auth/accept-terms")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
      expect(res.body.version).toBe("1.0");
    });

    test("returns 401 with a refresh token used as access token", async () => {
      const refreshToken = jwt.sign(
        { sub: 1, type: "refresh" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      const res = await request(app)
        .post("/api/auth/accept-terms")
        .set("Authorization", `Bearer ${refreshToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Invalid token type");
    });
  });
});
