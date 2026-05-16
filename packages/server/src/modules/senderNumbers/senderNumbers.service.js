// packages/server/src/modules/senderNumbers/senderNumbers.service.js

import pool from "../../config/database.js";
import { verifyAccountName } from "../momo/momo.service.js";
import { getAccountById } from "../momo/accounts.service.js";

// ─── Add Sender Number ────────────────────────────────────────────────────────

export const addSenderNumber = async (
  userId,
  phoneNumber,
  label,
  accountId,
) => {
  // Validate phone format
  const cleaned = (phoneNumber || "").replace(/\s+/g, "");
  if (!/^0[0-9]{9}$/.test(cleaned)) {
    throw Object.assign(
      new Error("Invalid phone number. Must be 10 digits starting with 0."),
      { status: 400 },
    );
  }

  if (!label || !label.trim()) {
    throw Object.assign(new Error("Label is required."), { status: 400 });
  }

  if (!accountId) {
    throw Object.assign(
      new Error("Account ID is required to verify the number."),
      {
        status: 400,
      },
    );
  }

  // Check for duplicate — same user cannot add the same number twice
  const [existing] = await pool.query(
    "SELECT id FROM sender_numbers WHERE user_id = ? AND phone_number = ?",
    [userId, cleaned],
  );
  if (existing.length > 0) {
    throw Object.assign(
      new Error("This number is already saved to your account."),
      { status: 409, code: "DUPLICATE_NUMBER" },
    );
  }

  // Load disbursement account for MTN API call
  const account = await getAccountById(accountId);
  if (!account) {
    throw Object.assign(new Error("Disbursement account not found."), {
      status: 404,
      code: "ACCOUNT_NOT_FOUND",
    });
  }
  if (!account.is_active) {
    throw Object.assign(
      new Error("Selected disbursement account is inactive."),
      {
        status: 400,
        code: "ACCOUNT_INACTIVE",
      },
    );
  }

  // Verify name with MTN — store it permanently
  const result = await verifyAccountName(account, cleaned);
  if (!result.success) {
    const messages = {
      NOT_FOUND: "This number is not registered on MTN MoMo.",
      INVALID_NUMBER: "Invalid MoMo number.",
      API_ERROR: "Could not reach MTN at this time. Please try again.",
    };
    throw Object.assign(
      new Error(messages[result.reason] || "MTN verification failed."),
      { status: 400, code: result.reason || "API_ERROR" },
    );
  }

  // If this is the user's first number, make it the default
  const [countRows] = await pool.query(
    "SELECT COUNT(*) AS total FROM sender_numbers WHERE user_id = ?",
    [userId],
  );
  const isFirst = countRows[0].total === 0;

  const now = new Date();

  const [insertResult] = await pool.query(
    `INSERT INTO sender_numbers
       (user_id, phone_number, label, mtn_name, is_default, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [userId, cleaned, label.trim(), result.name, isFirst ? 1 : 0, now, now],
  );

  return getSenderNumberById(insertResult.insertId, userId);
};

// ─── Get All Sender Numbers for User ─────────────────────────────────────────

export const getSenderNumbers = async (userId) => {
  const [rows] = await pool.query(
    `SELECT id, phone_number, label, mtn_name, is_default, is_active, created_at
     FROM sender_numbers
     WHERE user_id = ?
     ORDER BY is_default DESC, created_at ASC`,
    [userId],
  );
  return rows;
};

// ─── Get Single Sender Number (scoped to user) ────────────────────────────────

export const getSenderNumberById = async (id, userId) => {
  const [rows] = await pool.query(
    `SELECT id, phone_number, label, mtn_name, is_default, is_active, created_at
     FROM sender_numbers
     WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
  return rows[0] || null;
};

// ─── Set Default ──────────────────────────────────────────────────────────────

export const setDefault = async (userId, id) => {
  // Confirm this number belongs to the user
  const number = await getSenderNumberById(id, userId);
  if (!number) {
    throw Object.assign(new Error("Sender number not found."), {
      status: 404,
      code: "NUMBER_NOT_FOUND",
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Clear existing default for this user
    await connection.query(
      "UPDATE sender_numbers SET is_default = 0 WHERE user_id = ?",
      [userId],
    );

    // Set new default
    await connection.query(
      "UPDATE sender_numbers SET is_default = 1, updated_at = ? WHERE id = ? AND user_id = ?",
      [new Date(), id, userId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getSenderNumberById(id, userId);
};

// ─── Update Label ─────────────────────────────────────────────────────────────

export const updateLabel = async (userId, id, label) => {
  if (!label || !label.trim()) {
    throw Object.assign(new Error("Label is required."), { status: 400 });
  }

  const number = await getSenderNumberById(id, userId);
  if (!number) {
    throw Object.assign(new Error("Sender number not found."), {
      status: 404,
      code: "NUMBER_NOT_FOUND",
    });
  }

  await pool.query(
    "UPDATE sender_numbers SET label = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [label.trim(), new Date(), id, userId],
  );

  return getSenderNumberById(id, userId);
};

// ─── Toggle Active ────────────────────────────────────────────────────────────

export const toggleActive = async (userId, id) => {
  const number = await getSenderNumberById(id, userId);
  if (!number) {
    throw Object.assign(new Error("Sender number not found."), {
      status: 404,
      code: "NUMBER_NOT_FOUND",
    });
  }

  await pool.query(
    "UPDATE sender_numbers SET is_active = NOT is_active, updated_at = ? WHERE id = ? AND user_id = ?",
    [new Date(), id, userId],
  );

  return getSenderNumberById(id, userId);
};

// ─── Delete Sender Number ─────────────────────────────────────────────────────

export const deleteSenderNumber = async (userId, id) => {
  const number = await getSenderNumberById(id, userId);
  if (!number) {
    throw Object.assign(new Error("Sender number not found."), {
      status: 404,
      code: "NUMBER_NOT_FOUND",
    });
  }

  // Prevent deletion if this number has been used in a batch
  const [batches] = await pool.query(
    "SELECT id FROM batches WHERE sender_number_id = ? LIMIT 1",
    [id],
  );
  if (batches.length > 0) {
    throw Object.assign(
      new Error(
        "Cannot delete a number that has been used in a batch. Deactivate it instead.",
      ),
      { status: 409, code: "NUMBER_IN_USE" },
    );
  }

  await pool.query("DELETE FROM sender_numbers WHERE id = ? AND user_id = ?", [
    id,
    userId,
  ]);
};
