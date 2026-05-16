// packages/server/src/modules/transfers/transfers.controller.js

import * as transfersService from "./transfers.service.js";

// ─── POST /api/transfers/batch ────────────────────────
export const createBatch = async (req, res) => {
  try {
    const {
      senderNumberId,
      reference,
      senderNumber,
      senderName,
      momoAccountId,
      recipients,
    } = req.body;

    if (!reference || !senderNumber || !senderName || !momoAccountId) {
      return res.status(400).json({ error: "All batch fields are required" });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: "Recipients list is required" });
    }

    const batch = await transfersService.createBatch({
      userId: req.user.id,
      senderNumberId: senderNumberId || null,
      reference,
      senderNumber,
      senderName,
      momoAccountId,
      recipients,
    });

    return res.status(201).json({ message: "Batch created", batch });
  } catch (error) {
    console.error("createBatch error:", error.message);
    return res.status(500).json({ error: "Failed to create batch" });
  }
};

// ─── GET /api/transfers/batches ───────────────────────
export const getAllBatches = async (req, res) => {
  try {
    const batches = await transfersService.getAllBatches(req.user.id);
    return res.json({ batches });
  } catch (error) {
    console.error("getAllBatches error:", error.message);
    return res.status(500).json({ error: "Failed to fetch batches" });
  }
};

// ─── GET /api/transfers/batch/:batchId ────────────────
export const getBatch = async (req, res) => {
  try {
    const batch = await transfersService.getBatchById(
      req.params.batchId,
      req.user.id,
    );

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    return res.json({ batch });
  } catch (error) {
    console.error("getBatch error:", error.message);
    return res.status(500).json({ error: "Failed to fetch batch" });
  }
};

// ─── POST /api/transfers/batch/:batchId/execute ───────
export const executeBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const result = await transfersService.executeBatch(batchId, req.user.id);
    return res.json({ message: "Batch executed", result });
  } catch (error) {
    if (error.message === "BATCH_NOT_FOUND") {
      return res.status(404).json({ error: "Batch not found" });
    }
    if (error.message === "BATCH_ALREADY_RUNNING") {
      return res.status(409).json({ error: "Batch is already running" });
    }
    if (error.message === "ACCOUNT_NOT_FOUND") {
      return res.status(404).json({ error: "Disbursement account not found" });
    }
    console.error("executeBatch error:", error.message);
    return res.status(500).json({ error: "Failed to execute batch" });
  }
};

// ─── POST /api/transfers/batch/:batchId/transfer/:transferId/execute
export const executeSingle = async (req, res) => {
  try {
    const { batchId, transferId } = req.params;
    const result = await transfersService.executeSingleTransfer(
      transferId,
      batchId,
      req.user.id,
    );
    return res.json({ message: "Transfer executed", result });
  } catch (error) {
    if (error.message === "TRANSFER_NOT_FOUND") {
      return res.status(404).json({ error: "Transfer not found" });
    }
    if (error.message === "ALREADY_PAID") {
      return res
        .status(409)
        .json({ error: "This transfer has already been paid" });
    }
    if (error.message === "ACCOUNT_NOT_FOUND") {
      return res.status(404).json({ error: "Disbursement account not found" });
    }
    console.error("executeSingle error:", error.message);
    return res.status(500).json({ error: "Failed to execute transfer" });
  }
};

// ─── PATCH /api/transfers/batch/:batchId/transfer/:transferId
export const updateTransfer = async (req, res) => {
  try {
    const { transferId } = req.params;
    const { amount, recipientNameInput } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const transfer = await transfersService.updateTransfer(
      transferId,
      req.user.id,
      { amount, recipientNameInput },
    );

    return res.json({ message: "Transfer updated", transfer });
  } catch (error) {
    if (error.message === "TRANSFER_NOT_FOUND") {
      return res.status(404).json({ error: "Transfer not found" });
    }
    if (error.message === "TRANSFER_NOT_EDITABLE") {
      return res
        .status(409)
        .json({ error: "Only pending transfers can be edited" });
    }
    console.error("updateTransfer error:", error.message);
    return res.status(500).json({ error: "Failed to update transfer" });
  }
};

// ─── DELETE /api/transfers/batch/:batchId/transfer/:transferId
export const deleteTransfer = async (req, res) => {
  try {
    const { transferId } = req.params;
    await transfersService.deleteTransfer(transferId, req.user.id);
    return res.json({ message: "Transfer removed" });
  } catch (error) {
    if (error.message === "TRANSFER_NOT_FOUND") {
      return res.status(404).json({ error: "Transfer not found" });
    }
    if (error.message === "TRANSFER_NOT_DELETABLE") {
      return res
        .status(409)
        .json({ error: "Only pending transfers can be deleted" });
    }
    console.error("deleteTransfer error:", error.message);
    return res.status(500).json({ error: "Failed to delete transfer" });
  }
};
