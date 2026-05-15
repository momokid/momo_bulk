import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// ─── authenticate ─────────────────────────────────────────────────────────────
// Verifies the JWT access token from the Authorization header.
// Attaches req.user = { id } on success.
// Stateless — no DB call on every request.

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, env.jwt.secret);

    // Reject refresh tokens used as access tokens
    if (payload.type !== "access") {
      return res.status(401).json({ error: "Invalid token type." });
    }

    req.user = { id: payload.sub };
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Session expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid token." });
  }
};
