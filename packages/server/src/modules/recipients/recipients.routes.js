import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import * as controller from "./recipients.controller.js";

const router = Router();

// ─── Multer — memory storage, CSV only, 2MB max ──────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

// ─── Rate limiter for name verification ──────────────
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many verification requests. Please wait a moment." },
});

// ─── Multer error handler ─────────────────────────────
const handleUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "File too large. Maximum size is 2MB." });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

router.post("/parse-csv", handleUpload, controller.parseCSV);
router.post("/verify-names", verifyLimiter, controller.verifyNames);

export default router;
