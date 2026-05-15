import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as controller from "./reports.controller.js";

const router = Router();

const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many report requests. Please wait a moment." },
});

router.get(
  "/batch/:batchId/advice/:transferId",
  reportLimiter,
  controller.singleAdvice,
);

router.get("/batch/:batchId/advice", reportLimiter, controller.batchAdvice);

router.get("/batch/:batchId/export", reportLimiter, controller.exportBatchCSV);

export default router;
