import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as controller from "./accounts.controller.js";

const router = Router();

// Limit provisioning to 10 requests per hour per IP
// Creating an MTN API user is a sensitive one-time operation
const provisionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many account creation attempts. Try again later." },
});

router.post("/", provisionLimiter, controller.createAccount);
router.get("/", controller.getAllAccounts);
router.patch("/:id/label", controller.updateLabel);
router.patch("/:id/toggle", controller.toggleStatus);
router.delete("/:id", controller.deleteAccount);

export default router;
