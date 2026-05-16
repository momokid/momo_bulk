// packages/server/src/modules/transfers/transfers.routes.js

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../../middleware/authenticate.js";
import * as controller from "./transfers.controller.js";

const router = Router();

// ─── Rate limit on execution endpoints ───────────────────────────────────────
// 5 executions per minute — prevents accidental double execution
const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many execution requests. Please wait a moment." },
});

// ─── All routes require authentication ───────────────────────────────────────
router.use(authenticate);

// ─── Batch ────────────────────────────────────────────
router.post("/batch", controller.createBatch);
router.get("/batches", controller.getAllBatches);
router.get("/batch/:batchId", controller.getBatch);
router.post("/batch/:batchId/execute", executeLimiter, controller.executeBatch);

// ─── Individual Transfer ──────────────────────────────
router.post(
  "/batch/:batchId/transfer/:transferId/execute",
  executeLimiter,
  controller.executeSingle,
);
router.patch("/batch/:batchId/transfer/:transferId", controller.updateTransfer);
router.delete(
  "/batch/:batchId/transfer/:transferId",
  controller.deleteTransfer,
);

export default router;
