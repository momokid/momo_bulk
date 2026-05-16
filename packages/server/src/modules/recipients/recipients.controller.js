// packages/server/src/modules/recipients/recipients.controller.js

import csv from "csv-parser";
import { Readable } from "stream";
import { verifyAccountName } from "../momo/momo.service.js";
import { getAccountById } from "../momo/accounts.service.js";
import { matchNames } from "../../utils/fuzzyMatch.js";

// ─── Delay helper ─────────────────────────────────────
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Example numbers from the CSV template ────────────
// Rows containing these are excluded with a warning — never sent to MTN
const EXAMPLE_NUMBERS = ["0241234567", "0551234567", "0261234567"];

// ─── Map friendly CSV column headers to internal keys ─
// Accepts: "Mobile Number", "Full Name", "Amount (GHS)"
// Falls back to lowercase header for unknown columns
const mapHeader = ({ header }) => {
  const h = header.trim().toLowerCase();
  const map = {
    "mobile number": "phone",
    "full name": "name",
    "amount (ghs)": "amount",
  };
  return map[h] ?? h;
};

// ─── Validate a single recipient row ─────────────────
const validateRow = (row, index) => {
  const rowNum = index + 1; // 1-based for user-facing messages
  const errors = [];

  const phone = (row.phone || "").toString().replace(/\s+/g, "");
  const name = (row.name || "").toString().trim();
  const amount = parseFloat(row.amount);

  // Check for example numbers before any other validation
  if (EXAMPLE_NUMBERS.includes(phone)) {
    return {
      index,
      rowNum,
      phone,
      name,
      amount: isNaN(amount) ? 0 : amount,
      errors: [],
      valid: false,
      excluded: true,
      excludeReason: "EXAMPLE_NUMBER",
    };
  }

  if (!phone) {
    errors.push(`Row ${rowNum} — Mobile Number is required`);
  } else if (!/^0[0-9]{9}$/.test(phone)) {
    errors.push(`Row ${rowNum} — Mobile Number format is invalid`);
  }

  if (!name) {
    errors.push(`Row ${rowNum} — Full Name is required`);
  }

  if (isNaN(amount) || amount <= 0) {
    errors.push(`Row ${rowNum} — Amount (GHS) must be a positive number`);
  }

  return {
    index,
    rowNum,
    phone,
    name,
    amount: isNaN(amount) ? 0 : amount,
    errors,
    valid: errors.length === 0,
    excluded: false,
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
        .pipe(csv({ mapHeaders: mapHeader }))
        .on("data", (row) => results.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    if (results.length === 0) {
      return res.status(400).json({ error: "CSV file is empty" });
    }

    if (results.length > 500) {
      return res
        .status(400)
        .json({ error: "Maximum 500 recipients per batch" });
    }

    const validated = results.map((row, index) => validateRow(row, index));

    const excludedCount = validated.filter((r) => r.excluded).length;
    const validCount = validated.filter((r) => r.valid).length;
    const invalidCount = validated.filter(
      (r) => !r.valid && !r.excluded
    ).length;
    const hasExampleNumbers = excludedCount > 0;

    return res.json({
      total: validated.length,
      validCount,
      invalidCount,
      excludedCount,
      hasExampleNumbers,
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
      // Skip excluded rows — never sent to MTN
      if (recipient.excluded) {
        verified.push({
          ...recipient,
          mtnName: null,
          matchScore: 0,
          matchStatus: "EXCLUDED",
        });
        continue;
      }

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