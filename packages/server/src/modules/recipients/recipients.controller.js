import csv from "csv-parser";
import { Readable } from "stream";
import { verifyAccountName } from "../momo/momo.service.js";
import { getAccountById } from "../momo/accounts.service.js";
import { matchNames } from "../../utils/fuzzyMatch.js";

// ─── Delay helper ─────────────────────────────────────
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Validate a single recipient row ─────────────────
const validateRow = (row, index) => {
  const errors = [];

  const phone = (row.phone || "").toString().replace(/\s+/g, "");
  const name = (row.name || "").toString().trim();
  const amount = parseFloat(row.amount);

  if (!/^0[0-9]{9}$/.test(phone)) {
    errors.push("Invalid phone number format");
  }

  if (!name) {
    errors.push("Name is required");
  }

  if (isNaN(amount) || amount <= 0) {
    errors.push("Amount must be a positive number");
  }

  return {
    index,
    phone,
    name,
    amount,
    errors,
    valid: errors.length === 0,
  };
};

// ─── POST /api/recipients/parse-csv ──────────────────
export const parseCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const results = [];
    const readable = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      readable
        .pipe(csv({ mapHeaders: ({ header }) => header.trim().toLowerCase() }))
        .on("data", (row) => results.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    if (results.length === 0) {
      return res.status(400).json({ error: "CSV file is empty" });
    }

    if (results.length > 500) {
      return res.status(400).json({
        error: "Maximum 500 recipients per batch",
      });
    }

    // Validate every row
    const validated = results.map((row, index) => validateRow(row, index));

    const validCount = validated.filter((r) => r.valid).length;
    const invalidCount = validated.filter((r) => !r.valid).length;

    return res.json({
      total: validated.length,
      validCount,
      invalidCount,
      recipients: validated,
    });
  } catch (error) {
    console.error("parseCSV error:", error.message);
    return res.status(500).json({ error: "Failed to parse CSV file" });
  }
};

// ─── POST /api/recipients/verify-names ───────────────
export const verifyNames = async (req, res) => {
  try {
    const { recipients, accountId } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: "Recipients list is required" });
    }

    if (!accountId) {
      return res.status(400).json({ error: "Account ID is required" });
    }

    const account = await getAccountById(accountId);
    if (!account) {
      return res.status(404).json({ error: "Disbursement account not found" });
    }

    if (!account.is_active) {
      return res
        .status(400)
        .json({ error: "Selected disbursement account is inactive" });
    }

    const verified = [];

    for (const recipient of recipients) {
      // Skip already invalid rows — no point calling MTN for them
      if (!recipient.valid) {
        verified.push({
          ...recipient,
          mtnName: null,
          matchScore: 0,
          matchStatus: "INVALID",
        });
        continue;
      }

      // Call MTN to get registered name
      const result = await verifyAccountName(account, recipient.phone);

      if (!result.success) {
        verified.push({
          ...recipient,
          mtnName: null,
          matchScore: 0,
          matchStatus:
            result.reason === "NOT_FOUND" ? "NOT_FOUND" : "API_ERROR",
        });
      } else {
        const { score, status } = matchNames(recipient.name, result.name);

        verified.push({
          ...recipient,
          mtnName: result.name,
          matchScore: score,
          matchStatus: status,
        });
      }

      // Delay between MTN calls to avoid rate limiting
      await delay(300);
    }

    return res.json({
      total: verified.length,
      recipients: verified,
    });
  } catch (error) {
    console.error("verifyNames error:", error.message);
    return res.status(500).json({ error: "Name verification failed" });
  }
};
