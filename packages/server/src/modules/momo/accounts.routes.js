// packages/server/src/modules/momo/accounts.routes.js

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../../middleware/authenticate.js";
import * as controller from "./accounts.controller.js";

const router = Router();

// ─── Rate limit provisioning — MTN API call, one-time operation ───────────────
const provisionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many account creation attempts. Try again later." },
});

// ─── All routes require authentication ────────────────────────────────────────
router.use(authenticate);

router.post("/", provisionLimiter, controller.createAccount);
router.get("/", controller.getAccount);
router.patch("/:id/label", controller.updateLabel);
router.patch("/:id/toggle", controller.toggleStatus);
router.delete("/:id", controller.deleteAccount);

export default router;
