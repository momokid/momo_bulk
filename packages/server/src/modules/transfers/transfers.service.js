import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { disburse, getTransferStatus } from "../momo/momo.service.js";
import { getAccountById } from "../momo/accounts.service.js";

// ─── Delay helper ─────────────────────────────────────
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Reset stuck transfers on server startup ──────────
export const resetStuckTransfers = async () => {
  const [result] = await pool.query(
    `UPDATE transfers SET status = 'pending'
     WHERE status = 'processing'`,
  );
  if (result.affectedRows > 0) {
    console.log(`Reset ${result.affectedRows} stuck transfer(s) to pending`);
  }
};

// ─── Create Batch ─────────────────────────────────────
export const createBatch = async ({
  userId,
  senderNumberId,
  reference,
  senderNumber,
  senderName,
  momoAccountId,
  recipients,
}) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Calculate totals from valid, approved recipients only
    const eligible = recipients.filter(
      (r) => r.valid && ["STRONG", "LIKELY", "WEAK"].includes(r.matchStatus),
    );

    const totalAmount = eligible.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalRecipients = eligible.length;

    // Insert batch
    const [batchResult] = await connection.query(
      `INSERT INTO batches
        (user_id, momo_account_id, sender_number_id, reference, sender_number,
         sender_name, total_recipients, total_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        userId,
        momoAccountId,
        senderNumberId || null,
        reference,
        senderNumber,
        senderName,
        totalRecipients,
        totalAmount,
      ],
    );

    const batchId = batchResult.insertId;

    // Insert each eligible recipient as a transfer
    for (const recipient of eligible) {
      const externalId = `${batchId}_${recipient.phone}_${Date.now()}`;

      await connection.query(
        `INSERT INTO transfers
          (user_id, batch_id, external_id, recipient_phone, recipient_name_input,
           recipient_name_mtn, match_score, amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          userId,
          batchId,
          externalId,
          recipient.phone,
          recipient.name,
          recipient.mtnName || null,
          recipient.matchScore || null,
          recipient.amount,
        ],
      );
    }

    await connection.commit();
    return getBatchById(batchId, userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// ─── Get Batch By ID (scoped to user) ─────────────────
export const getBatchById = async (batchId, userId) => {
  const [batches] = await pool.query(
    `SELECT b.*, ma.label AS account_label, ma.account_number
     FROM batches b
     LEFT JOIN momo_accounts ma ON b.momo_account_id = ma.id
     WHERE b.id = ? AND b.user_id = ?`,
    [batchId, userId],
  );

  if (batches.length === 0) return null;

  const [transfers] = await pool.query(
    `SELECT * FROM transfers WHERE batch_id = ? ORDER BY id ASC`,
    [batchId],
  );

  return { ...batches[0], transfers };
};

// ─── Get All Batches (scoped to user) ─────────────────
export const getAllBatches = async (userId) => {
  const [rows] = await pool.query(
    `SELECT b.*, ma.label AS account_label
     FROM batches b
     LEFT JOIN momo_accounts ma ON b.momo_account_id = ma.id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC`,
    [userId],
  );
  return rows;
};

// ─── Execute Single Transfer ──────────────────────────
export const executeSingleTransfer = async (transferId, batchId, userId) => {
  const [rows] = await pool.query(
    `SELECT t.*, b.momo_account_id, b.reference
     FROM transfers t
     JOIN batches b ON t.batch_id = b.id
     WHERE t.id = ? AND t.batch_id = ? AND b.user_id = ?`,
    [transferId, batchId, userId],
  );

  if (rows.length === 0) throw new Error("TRANSFER_NOT_FOUND");

  const transfer = rows[0];

  if (transfer.status === "success") throw new Error("ALREADY_PAID");

  const account = await getAccountById(transfer.momo_account_id);
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");

  return await processTransfer(transfer, account);
};

// ─── Execute All Pending Transfers in Batch ───────────
export const executeBatch = async (batchId, userId) => {
  const batch = await getBatchById(batchId, userId);
  if (!batch) throw new Error("BATCH_NOT_FOUND");

  if (batch.status === "processing") throw new Error("BATCH_ALREADY_RUNNING");

  const account = await getAccountById(batch.momo_account_id);
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");

  // Mark batch as processing
  await pool.query(`UPDATE batches SET status = 'processing' WHERE id = ?`, [
    batchId,
  ]);

  const pending = batch.transfers.filter((t) => t.status === "pending");
  const results = [];

  for (const transfer of pending) {
    const result = await processTransfer(transfer, account, batch.reference);
    results.push(result);
    await delay(500);
  }

  // Update batch final status
  const [counts] = await pool.query(
    `SELECT
       SUM(status = 'success') AS succeeded,
       SUM(status = 'failed')  AS failed,
       SUM(status = 'pending') AS pending
     FROM transfers WHERE batch_id = ?`,
    [batchId],
  );

  const { succeeded, failed, pendingCount } = counts[0];
  const finalStatus =
    failed > 0 || pendingCount > 0 ? "partially_failed" : "completed";

  await pool.query(`UPDATE batches SET status = ? WHERE id = ?`, [
    finalStatus,
    batchId,
  ]);

  return { batchId, results, status: finalStatus };
};

// ─── Process a Single Transfer (internal) ────────────
const processTransfer = async (transfer, account, reference = "") => {
  // Mark as processing
  await pool.query(`UPDATE transfers SET status = 'processing' WHERE id = ?`, [
    transfer.id,
  ]);

  const result = await disburse(account, {
    phone: transfer.recipient_phone,
    amount: transfer.amount,
    externalId: transfer.external_id,
    payerMessage: reference || "Payment",
    payeeNote: reference || "Payment",
  });

  if (result.success) {
    await pool.query(
      `UPDATE transfers
       SET status = 'success', mtn_reference = ?
       WHERE id = ?`,
      [result.referenceId, transfer.id],
    );

    return {
      transferId: transfer.id,
      status: "success",
      referenceId: result.referenceId,
    };
  } else {
    await pool.query(
      `UPDATE transfers
       SET status = 'failed', failure_reason = ?
       WHERE id = ?`,
      [result.message, transfer.id],
    );

    return {
      transferId: transfer.id,
      status: "failed",
      reason: result.message,
    };
  }
};

// ─── Update Transfer (edit before execution) ─────────
export const updateTransfer = async (
  transferId,
  userId,
  { amount, recipientNameInput },
) => {
  const [rows] = await pool.query(
    `SELECT t.* FROM transfers t
     JOIN batches b ON t.batch_id = b.id
     WHERE t.id = ? AND b.user_id = ?`,
    [transferId, userId],
  );

  if (rows.length === 0) throw new Error("TRANSFER_NOT_FOUND");
  if (rows[0].status !== "pending") throw new Error("TRANSFER_NOT_EDITABLE");

  await pool.query(
    `UPDATE transfers
     SET amount = ?, recipient_name_input = ?
     WHERE id = ?`,
    [amount, recipientNameInput, transferId],
  );

  const [updated] = await pool.query(
    `SELECT t.* FROM transfers t
     JOIN batches b ON t.batch_id = b.id
     WHERE t.id = ? AND b.user_id = ?`,
    [transferId, userId],
  );
  return updated[0];
};

// ─── Delete Transfer ──────────────────────────────────
export const deleteTransfer = async (transferId, userId) => {
  const [rows] = await pool.query(
    `SELECT t.* FROM transfers t
     JOIN batches b ON t.batch_id = b.id
     WHERE t.id = ? AND b.user_id = ?`,
    [transferId, userId],
  );

  if (rows.length === 0) throw new Error("TRANSFER_NOT_FOUND");
  if (rows[0].status !== "pending") throw new Error("TRANSFER_NOT_DELETABLE");

  await pool.query(`DELETE FROM transfers WHERE id = ?`, [transferId]);
};
