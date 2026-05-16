// packages/server/src/modules/senderNumbers/senderNumbers.controller.js

import * as senderNumbersService from "./senderNumbers.service.js";

// ─── POST /api/sender-numbers ─────────────────────────────────────────────────

export const addNumber = async (req, res) => {
  try {
    const { phoneNumber, label, accountId } = req.body;

    const number = await senderNumbersService.addSenderNumber(
      req.user.id,
      phoneNumber,
      label,
      accountId,
    );

    return res.status(201).json({
      message: "Sender number added successfully",
      senderNumber: number,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    if (error.status === 409) {
      return res.status(409).json({ error: error.message, code: error.code });
    }
    console.error("addNumber error:", error.message);
    return res.status(500).json({ error: "Failed to add sender number." });
  }
};

// ─── GET /api/sender-numbers ──────────────────────────────────────────────────

export const getNumbers = async (req, res) => {
  try {
    const numbers = await senderNumbersService.getSenderNumbers(req.user.id);
    return res.json({ senderNumbers: numbers });
  } catch (error) {
    console.error("getNumbers error:", error.message);
    return res.status(500).json({ error: "Failed to fetch sender numbers." });
  }
};

// ─── PATCH /api/sender-numbers/:id/default ────────────────────────────────────

export const setDefault = async (req, res) => {
  try {
    const { id } = req.params;

    const number = await senderNumbersService.setDefault(req.user.id, id);

    return res.json({
      message: "Default sender number updated",
      senderNumber: number,
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("setDefault error:", error.message);
    return res.status(500).json({ error: "Failed to update default number." });
  }
};

// ─── PATCH /api/sender-numbers/:id/label ─────────────────────────────────────

export const updateLabel = async (req, res) => {
  try {
    const { id } = req.params;
    const { label } = req.body;

    const number = await senderNumbersService.updateLabel(
      req.user.id,
      id,
      label,
    );

    return res.json({
      message: "Label updated",
      senderNumber: number,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("updateLabel error:", error.message);
    return res.status(500).json({ error: "Failed to update label." });
  }
};

// ─── PATCH /api/sender-numbers/:id/toggle ────────────────────────────────────

export const toggleActive = async (req, res) => {
  try {
    const { id } = req.params;

    const number = await senderNumbersService.toggleActive(req.user.id, id);

    return res.json({
      message: `Sender number ${number.is_active ? "activated" : "deactivated"}`,
      senderNumber: number,
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("toggleActive error:", error.message);
    return res
      .status(500)
      .json({ error: "Failed to toggle sender number status." });
  }
};

// ─── DELETE /api/sender-numbers/:id ──────────────────────────────────────────

export const deleteNumber = async (req, res) => {
  try {
    const { id } = req.params;

    await senderNumbersService.deleteSenderNumber(req.user.id, id);

    return res.json({ message: "Sender number deleted successfully" });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    if (error.status === 409) {
      return res.status(409).json({ error: error.message });
    }
    console.error("deleteNumber error:", error.message);
    return res.status(500).json({ error: "Failed to delete sender number." });
  }
};
