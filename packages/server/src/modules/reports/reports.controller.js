import pool from "../../config/database.js";
import {
  generateSingleAdvice,
  generateBatchAdvice,
  generateBatchCSV,
  getTransferWithBatch,
} from "./reports.service.js";

// ─── GET /api/reports/batch/:batchId/advice/:transferId
export const singleAdvice = async (req, res) => {
  try {
    const { batchId, transferId } = req.params;

    const transfer = await getTransferWithBatch(transferId, batchId);
    if (!transfer) {
      return res.status(404).json({ error: "Transfer not found" });
    }

    if (transfer.status !== "success") {
      return res.status(400).json({
        error: "Payment advice is only available for successful transfers",
      });
    }

    const pdf = await generateSingleAdvice(transfer);
    const filename = `advice_TXN-${String(transfer.id).padStart(8, "0")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdf.length);

    return res.send(pdf);
  } catch (error) {
    console.error("singleAdvice error:", error.message);
    return res.status(500).json({ error: "Failed to generate payment advice" });
  }
};

// ─── GET /api/reports/batch/:batchId/advice ───────────
export const batchAdvice = async (req, res) => {
  try {
    const { batchId } = req.params;

    const [batches] = await pool.query(
      `SELECT b.*, ma.label AS account_label, ma.account_number
       FROM batches b
       LEFT JOIN momo_accounts ma ON b.momo_account_id = ma.id
       WHERE b.id = ?`,
      [batchId],
    );

    if (batches.length === 0) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const [transfers] = await pool.query(
      `SELECT t.*,
              b.reference, b.sender_number, b.sender_name,
              ma.label AS account_label
       FROM transfers t
       JOIN batches b ON t.batch_id = b.id
       LEFT JOIN momo_accounts ma ON b.momo_account_id = ma.id
       WHERE t.batch_id = ? AND t.status = 'success'
       ORDER BY t.id ASC`,
      [batchId],
    );

    if (transfers.length === 0) {
      return res.status(400).json({
        error: "No successful transfers in this batch",
      });
    }

    const pdf = await generateBatchAdvice(transfers);
    const filename = `advice_BATCH-${String(batchId).padStart(6, "0")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdf.length);

    return res.send(pdf);
  } catch (error) {
    console.error("batchAdvice error:", error.message);
    return res.status(500).json({ error: "Failed to generate batch advice" });
  }
};

// ─── GET /api/reports/batch/:batchId/export ───────────
export const exportBatchCSV = async (req, res) => {
  try {
    const { batchId } = req.params;

    const [batches] = await pool.query(`SELECT * FROM batches WHERE id = ?`, [
      batchId,
    ]);

    if (batches.length === 0) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const [transfers] = await pool.query(
      `SELECT * FROM transfers WHERE batch_id = ? ORDER BY id ASC`,
      [batchId],
    );

    const batch = { ...batches[0], transfers };
    const csv = generateBatchCSV(batch);
    const filename = `export_BATCH-${String(batchId).padStart(6, "0")}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.send(csv);
  } catch (error) {
    console.error("exportBatchCSV error:", error.message);
    return res.status(500).json({ error: "Failed to export batch" });
  }
};
