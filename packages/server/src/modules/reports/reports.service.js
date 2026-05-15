import PDFDocument from "pdfkit";
import pool from "../../config/database.js";

// ─── Fetch transfer with batch details ───────────────
const getTransferWithBatch = async (transferId, batchId) => {
  const [rows] = await pool.query(
    `SELECT t.*,
            b.reference, b.sender_number, b.sender_name,
            ma.label AS account_label, ma.account_number
     FROM transfers t
     JOIN batches b      ON t.batch_id    = b.id
     LEFT JOIN momo_accounts ma ON b.momo_account_id = ma.id
     WHERE t.id = ? AND t.batch_id = ?`,
    [transferId, batchId],
  );
  return rows[0] || null;
};

// ─── Draw a single payment advice page ───────────────
const drawAdvicePage = (doc, transfer, isFirst = false) => {
  if (!isFirst) doc.addPage();

  const pageWidth = doc.page.width;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  // ── Header ─────────────────────────────────────────
  doc.rect(margin, 40, contentWidth, 60).fill("#1a1a2e");

  doc
    .fillColor("#ffffff")
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("PAYMENT ADVICE", margin + 20, 58, { width: contentWidth - 40 });

  doc
    .fontSize(9)
    .font("Helvetica")
    .text("MoMo Bulk Transfer", margin + 20, 80, { width: contentWidth - 40 });

  // ── Status Badge ───────────────────────────────────
  const isSuccess = transfer.status === "success";
  const badgeColor = isSuccess ? "#22c55e" : "#ef4444";
  const badgeText = isSuccess ? "SUCCESS" : "FAILED";

  doc.rect(pageWidth - margin - 90, 55, 80, 24).fill(badgeColor);

  doc
    .fillColor("#ffffff")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(badgeText, pageWidth - margin - 90, 62, {
      width: 80,
      align: "center",
    });

  // ── Divider ────────────────────────────────────────
  let y = 120;

  const drawRow = (label, value, labelColor = "#6b7280") => {
    doc
      .fillColor(labelColor)
      .fontSize(9)
      .font("Helvetica")
      .text(label, margin, y, { width: 150 });

    doc
      .fillColor("#111827")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(value || "—", margin + 160, y, { width: contentWidth - 160 });

    y += 22;
  };

  const drawDivider = () => {
    doc
      .moveTo(margin, y)
      .lineTo(margin + contentWidth, y)
      .strokeColor("#e5e7eb")
      .lineWidth(0.5)
      .stroke();
    y += 14;
  };

  // ── Sender Details ─────────────────────────────────
  doc
    .fillColor("#374151")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("SENDER", margin, y);
  y += 16;
  drawDivider();
  drawRow("Name", transfer.sender_name);
  drawRow("MoMo Number", transfer.sender_number);
  drawRow("Account", transfer.account_label || "N/A");
  drawRow("Reference", transfer.reference);

  y += 8;

  // ── Recipient Details ──────────────────────────────
  doc
    .fillColor("#374151")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("RECIPIENT", margin, y);
  y += 16;
  drawDivider();
  drawRow("Name", transfer.recipient_name_mtn || transfer.recipient_name_input);
  drawRow("MoMo Number", transfer.recipient_phone);
  drawRow("Amount", `GHS ${parseFloat(transfer.amount).toFixed(2)}`);

  y += 8;

  // ── Transaction Details ────────────────────────────
  doc
    .fillColor("#374151")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("TRANSACTION", margin, y);
  y += 16;
  drawDivider();
  drawRow("MTN Reference", transfer.mtn_reference || "N/A");
  drawRow("Batch ID", `BATCH-${String(transfer.batch_id).padStart(6, "0")}`);
  drawRow("Transfer ID", `TXN-${String(transfer.id).padStart(8, "0")}`);
  drawRow(
    "Date & Time",
    new Date(transfer.updated_at).toLocaleString("en-GH", {
      dateStyle: "long",
      timeStyle: "short",
    }),
  );

  if (transfer.status === "failed" && transfer.failure_reason) {
    y += 8;
    drawRow("Failure Reason", transfer.failure_reason, "#ef4444");
  }

  // ── Footer ─────────────────────────────────────────
  doc.rect(margin, y + 20, contentWidth, 1).fill("#e5e7eb");

  doc
    .fillColor("#9ca3af")
    .fontSize(8)
    .font("Helvetica")
    .text(
      "This is a system-generated payment advice. Keep this for your records.",
      margin,
      y + 32,
      { width: contentWidth, align: "center" },
    );
};

// ─── Generate Single Advice PDF ───────────────────────
export const generateSingleAdvice = (transfer) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "A5" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawAdvicePage(doc, transfer, true);
    doc.end();
  });
};

// ─── Generate Combined Batch PDF ──────────────────────
export const generateBatchAdvice = (transfers) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "A5" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    transfers.forEach((transfer, index) => {
      drawAdvicePage(doc, transfer, index === 0);
    });

    doc.end();
  });
};

// ─── Generate Batch CSV Export ────────────────────────
export const generateBatchCSV = (batch) => {
  const headers = [
    "Transfer ID",
    "Recipient Name",
    "MTN Name",
    "Phone",
    "Amount (GHS)",
    "Match Score",
    "Status",
    "MTN Reference",
    "Failure Reason",
    "Date",
  ].join(",");

  const rows = batch.transfers.map((t) =>
    [
      `TXN-${String(t.id).padStart(8, "0")}`,
      `"${t.recipient_name_input}"`,
      `"${t.recipient_name_mtn || ""}"`,
      t.recipient_phone,
      parseFloat(t.amount).toFixed(2),
      t.match_score || "",
      t.status,
      t.mtn_reference || "",
      `"${t.failure_reason || ""}"`,
      new Date(t.updated_at).toISOString(),
    ].join(","),
  );

  return [headers, ...rows].join("\n");
};

// ─── Get transfer for advice ──────────────────────────
export { getTransferWithBatch };
