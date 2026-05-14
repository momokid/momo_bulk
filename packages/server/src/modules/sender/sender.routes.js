import { Router } from "express";
import rateLimit from "express-rate-limit";
import { verifySender } from "./sender.controller.js";

const router = Router();

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: "Too many verification attempts. Please wait and try again.",
  },
});

router.post("/verify", verifyLimiter, verifySender);

export default router;
