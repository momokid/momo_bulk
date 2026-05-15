import { jest } from "@jest/globals";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.unstable_mockModule("../src/config/database.js", () => ({
  default: { query: jest.fn() },
}));

jest.unstable_mockModule("bcryptjs", () => ({
  default: {
    hash: jest.fn(),
    compare: jest.fn(),
  },
}));

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    sign: jest.fn(),
    verify: jest.fn(),
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

const { default: pool } = await import("../src/config/database.js");
const { default: bcrypt } = await import("bcryptjs");
const { default: jwt } = await import("jsonwebtoken");
const { register, login, refreshToken, logout, acceptTerms } =
  await import("../src/modules/auth/auth.service.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUser = {
  id: 1,
  email: "test@example.com",
  password: "hashed_password",
  is_active: 1,
  terms_accepted_at: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Auth Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default token returns
    jwt.sign
      .mockReturnValueOnce("mock-access-token")
      .mockReturnValueOnce("mock-refresh-token");
  });

  // ── register ───────────────────────────────────────
  describe("register", () => {
    test("creates user and returns access and refresh tokens", async () => {
      pool.query
        .mockResolvedValueOnce([[]]) // duplicate check — no existing user
        .mockResolvedValueOnce([{ insertId: 1 }]); // insert user

      bcrypt.hash.mockResolvedValueOnce("hashed_password");

      const result = await register(
        "Test@Example.com",
        "password123",
        "127.0.0.1",
      );

      expect(result.accessToken).toBe("mock-access-token");
      expect(result.refreshToken).toBe("mock-refresh-token");
      expect(result.user.id).toBe(1);
    });

    test("normalises email to lowercase before saving", async () => {
      pool.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 1 }]);

      bcrypt.hash.mockResolvedValueOnce("hashed_password");

      const result = await register(
        "TEST@EXAMPLE.COM",
        "password123",
        "127.0.0.1",
      );

      expect(result.user.email).toBe("test@example.com");

      // Confirm lowercase was passed to the duplicate check query
      const duplicateCheckArgs = pool.query.mock.calls[0][1];
      expect(duplicateCheckArgs[0]).toBe("test@example.com");
    });

    test("throws 400 if email is missing", async () => {
      await expect(register("", "password123")).rejects.toMatchObject({
        status: 400,
      });
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("throws 400 if password is missing", async () => {
      await expect(register("test@example.com", "")).rejects.toMatchObject({
        status: 400,
      });
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("throws 409 if email already exists", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // existing user found

      await expect(
        register("test@example.com", "password123"),
      ).rejects.toMatchObject({ status: 409 });

      // Should not attempt to insert
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  // ── login ──────────────────────────────────────────
  describe("login", () => {
    test("returns tokens on valid credentials", async () => {
      pool.query
        .mockResolvedValueOnce([[mockUser]]) // find user
        .mockResolvedValueOnce([{}]); // update last_login_at

      bcrypt.compare.mockResolvedValueOnce(true);

      const result = await login("test@example.com", "password123");

      expect(result.accessToken).toBe("mock-access-token");
      expect(result.refreshToken).toBe("mock-refresh-token");
      expect(result.user.email).toBe("test@example.com");
    });

    test("returns termsAcceptedAt in user payload", async () => {
      pool.query
        .mockResolvedValueOnce([[mockUser]])
        .mockResolvedValueOnce([{}]);

      bcrypt.compare.mockResolvedValueOnce(true);

      const result = await login("test@example.com", "password123");

      expect(result.user).toHaveProperty("termsAcceptedAt");
    });

    test("updates last_login_at on successful login", async () => {
      pool.query
        .mockResolvedValueOnce([[mockUser]])
        .mockResolvedValueOnce([{}]);

      bcrypt.compare.mockResolvedValueOnce(true);

      await login("test@example.com", "password123");

      const updateCall = pool.query.mock.calls[1][0];
      expect(updateCall).toContain("last_login_at");
    });

    test("throws 400 if email is missing", async () => {
      await expect(login("", "password123")).rejects.toMatchObject({
        status: 400,
      });
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("throws 400 if password is missing", async () => {
      await expect(login("test@example.com", "")).rejects.toMatchObject({
        status: 400,
      });
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("throws 401 if email not found", async () => {
      pool.query.mockResolvedValueOnce([[]]); // no user found

      await expect(
        login("nobody@example.com", "password123"),
      ).rejects.toMatchObject({
        status: 401,
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test("throws 401 if password does not match", async () => {
      pool.query.mockResolvedValueOnce([[mockUser]]);
      bcrypt.compare.mockResolvedValueOnce(false);

      await expect(
        login("test@example.com", "wrongpassword"),
      ).rejects.toMatchObject({
        status: 401,
      });
    });

    test("throws 403 if account is deactivated", async () => {
      pool.query.mockResolvedValueOnce([[{ ...mockUser, is_active: 0 }]]);
      bcrypt.compare.mockResolvedValueOnce(true);

      await expect(
        login("test@example.com", "password123"),
      ).rejects.toMatchObject({
        status: 403,
      });
    });
  });

  // ── refreshToken ───────────────────────────────────
  describe("refreshToken", () => {
    test("returns a new access token for a valid refresh token", async () => {
      jwt.verify.mockReturnValueOnce({ sub: 1, type: "refresh" });
      pool.query.mockResolvedValueOnce([[{ id: 1, is_active: 1 }]]);

      // Only one sign call needed (new access token)
      jwt.sign.mockReset();
      jwt.sign.mockReturnValueOnce("new-access-token");

      const result = await refreshToken("valid-refresh-token");

      expect(result.accessToken).toBe("new-access-token");
    });

    test("throws 401 if token is missing", async () => {
      await expect(refreshToken(null)).rejects.toMatchObject({ status: 401 });
      expect(jwt.verify).not.toHaveBeenCalled();
    });

    test("throws 401 if token is invalid or expired", async () => {
      jwt.verify.mockImplementationOnce(() => {
        throw new Error("invalid token");
      });

      await expect(refreshToken("bad-token")).rejects.toMatchObject({
        status: 401,
      });
    });

    test("throws 401 if token type is not refresh", async () => {
      jwt.verify.mockReturnValueOnce({ sub: 1, type: "access" });

      await expect(
        refreshToken("access-token-used-as-refresh"),
      ).rejects.toMatchObject({
        status: 401,
      });
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("throws 401 if user no longer exists", async () => {
      jwt.verify.mockReturnValueOnce({ sub: 999, type: "refresh" });
      pool.query.mockResolvedValueOnce([[]]); // no user found

      await expect(refreshToken("valid-token")).rejects.toMatchObject({
        status: 401,
      });
    });

    test("throws 401 if user is deactivated", async () => {
      jwt.verify.mockReturnValueOnce({ sub: 1, type: "refresh" });
      pool.query.mockResolvedValueOnce([[{ id: 1, is_active: 0 }]]);

      await expect(refreshToken("valid-token")).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  // ── logout ─────────────────────────────────────────
  describe("logout", () => {
    test("returns success (cookie cleared by controller)", async () => {
      const result = await logout(1);
      expect(result.success).toBe(true);
    });
  });

  // ── acceptTerms ────────────────────────────────────
  describe("acceptTerms", () => {
    test("stamps terms_accepted_at for the user", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await acceptTerms(1, "127.0.0.1");

      expect(result.accepted).toBe(true);
      expect(result.version).toBe("1.0");
      expect(result.acceptedAt).toBeInstanceOf(Date);

      const updateCall = pool.query.mock.calls[0][0];
      expect(updateCall).toContain("terms_accepted_at");
    });

    test("throws 400 if userId is missing", async () => {
      await expect(acceptTerms(null, "127.0.0.1")).rejects.toMatchObject({
        status: 400,
      });
      expect(pool.query).not.toHaveBeenCalled();
    });
  });
});
