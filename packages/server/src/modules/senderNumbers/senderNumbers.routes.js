// packages/server/src/modules/senderNumbers/senderNumbers.routes.js

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../../middleware/authenticate.js";
import * as controller from "./senderNumbers.controller.js";

const router = Router();

// ─── Rate limiter for add — calls MTN API ─────────────────────────────────────
// 20 requests per 15 minutes per IP
const addLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests. Please try again later." },
});

// ─── All routes require authentication ────────────────────────────────────────
router.use(authenticate);

router.post("/", addLimiter, controller.addNumber);
router.get("/", controller.getNumbers);
router.patch("/:id/default", controller.setDefault);
router.patch("/:id/label", controller.updateLabel);
router.patch("/:id/toggle", controller.toggleActive);
router.delete("/:id", controller.deleteNumber);

export default router;
