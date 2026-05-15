import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as controller from "./auth.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

// ─── Strict limiter for login and register ────────────────────────────────────
// 10 attempts per 15 minutes per IP — brute force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
});

// ─── Token refresh limiter ────────────────────────────────────────────────────
// 30 per 15 minutes — allows normal SPA usage without blocking
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many refresh requests. Please try again shortly." },
});

// ─── Routes ───────────────────────────────────────────────────────────────────
router.post("/register", authLimiter, controller.register);
router.post("/login", authLimiter, controller.login);
router.post("/refresh", refreshLimiter, controller.refresh);
router.post("/logout", controller.logout);

router.post("/accept-terms", authenticate, controller.acceptTerms);

export default router;
