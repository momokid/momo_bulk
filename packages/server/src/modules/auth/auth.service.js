import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../../config/database.js";

const TERMS_VERSION = "1.0";
const SALT_ROUNDS = parseInt(process.env.PIN_SALT_ROUNDS) || 10;

// ─── Token helpers ────────────────────────────────────────────────────────────

function signAccessToken(userId) {
  return jwt.sign({ sub: userId, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "2h",
  });
}

function signRefreshToken(userId) {
  return jwt.sign({ sub: userId, type: "refresh" }, process.env.JWT_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  });
}

// ─── register ─────────────────────────────────────────────────────────────────

export async function register(email, password, ip) {
  if (!email || !password) {
    throw Object.assign(new Error("Email and password are required."), {
      status: 400,
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Duplicate check
  const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [
    normalizedEmail,
  ]);
  if (existing.length > 0) {
    throw Object.assign(
      new Error("An account with this email already exists."),
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date();

  const [result] = await pool.query(
    `INSERT INTO users
       (email, password, terms_accepted_at, terms_version, accepted_from_ip, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [normalizedEmail, passwordHash, now, TERMS_VERSION, ip || null, now, now],
  );

  const userId = result.insertId;

  return {
    accessToken: signAccessToken(userId),
    refreshToken: signRefreshToken(userId),
    user: {
      id: userId,
      email: normalizedEmail,
      termsAcceptedAt: now,
    },
  };
}

// ─── login ────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  if (!email || !password) {
    throw Object.assign(new Error("Email and password are required."), {
      status: 400,
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const [rows] = await pool.query(
    "SELECT id, email, password, is_active, terms_accepted_at FROM users WHERE email = ?",
    [normalizedEmail],
  );

  // Intentionally vague error — do not reveal whether the email exists
  const invalid = Object.assign(new Error("Invalid email or password."), {
    status: 401,
  });

  if (rows.length === 0) throw invalid;

  const user = rows[0];

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) throw invalid;

  if (!user.is_active) {
    throw Object.assign(new Error("This account has been deactivated."), {
      status: 403,
    });
  }

  // Update last login timestamp
  await pool.query(
    "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?",
    [new Date(), new Date(), user.id],
  );

  return {
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      termsAcceptedAt: user.terms_accepted_at, // null = must accept T&C
    },
  };
}

// ─── refreshToken ─────────────────────────────────────────────────────────────

export async function refreshToken(token) {
  if (!token) {
    throw Object.assign(new Error("Refresh token missing."), { status: 401 });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw Object.assign(new Error("Invalid or expired refresh token."), {
      status: 401,
    });
  }

  if (payload.type !== "refresh") {
    throw Object.assign(new Error("Invalid token type."), { status: 401 });
  }

  // Confirm user still exists and is active
  const [rows] = await pool.query(
    "SELECT id, is_active FROM users WHERE id = ?",
    [payload.sub],
  );

  if (rows.length === 0 || !rows[0].is_active) {
    throw Object.assign(new Error("User not found or deactivated."), {
      status: 401,
    });
  }

  return {
    accessToken: signAccessToken(payload.sub),
  };
}

// ─── logout ───────────────────────────────────────────────────────────────────

// No server-side token blacklist (stateless, no Redis).
// The controller clears the httpOnly cookie.
// This function exists as a hook for any future cleanup (e.g. audit log).
export async function logout(userId) {
  // No-op for now — cookie cleared by controller
  return { success: true };
}

// ─── acceptTerms ──────────────────────────────────────────────────────────────

// Called when a logged-in user hits the T&C wall (terms_accepted_at is NULL).
export async function acceptTerms(userId, ip) {
  if (!userId) {
    throw Object.assign(new Error("User ID required."), { status: 400 });
  }

  const now = new Date();

  const [result] = await pool.query(
    `UPDATE users
     SET terms_accepted_at = ?, terms_version = ?, accepted_from_ip = ?, updated_at = ?
     WHERE id = ? AND terms_accepted_at IS NULL`,
    [now, TERMS_VERSION, ip || null, now, userId],
  );

  if (result.affectedRows === 0) {
    // Either user not found or already accepted — treat as success either way
  }

  return { accepted: true, version: TERMS_VERSION, acceptedAt: now };
}
