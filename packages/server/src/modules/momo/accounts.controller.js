import * as accountsService from "./accounts.service.js";

// ─── POST /api/accounts ───────────────────────────────
export const createAccount = async (req, res) => {
  try {
    const { label, accountNumber, environment } = req.body;

    if (!label || !accountNumber) {
      return res.status(400).json({
        error: "Label and account number are required",
      });
    }

    // Basic Ghana MoMo number validation
    const cleaned = accountNumber.replace(/\s+/g, "");
    if (!/^0[0-9]{9}$/.test(cleaned)) {
      return res.status(400).json({
        error: "Invalid MoMo number format. Must be 10 digits starting with 0",
      });
    }

    const account = await accountsService.createAccount({
      label,
      accountNumber: cleaned,
      environment: environment || "sandbox",
    });

    return res.status(201).json({
      message: "Account created and credentials provisioned successfully",
      account,
    });
  } catch (error) {
    if (error.message === "DUPLICATE_ACCOUNT") {
      return res.status(409).json({
        error: "This MoMo number is already registered",
      });
    }

    console.error("createAccount error:", error.message);
    return res.status(500).json({
      error: "Failed to provision account with MTN. Please try again.",
    });
  }
};

// ─── GET /api/accounts ────────────────────────────────
export const getAllAccounts = async (req, res) => {
  try {
    const accounts = await accountsService.getAllAccounts();
    return res.json({ accounts });
  } catch (error) {
    console.error("getAllAccounts error:", error.message);
    return res.status(500).json({ error: "Failed to fetch accounts" });
  }
};

// ─── PATCH /api/accounts/:id/label ───────────────────
export const updateLabel = async (req, res) => {
  try {
    const { id } = req.params;
    const { label } = req.body;

    if (!label) {
      return res.status(400).json({ error: "Label is required" });
    }

    const account = await accountsService.updateAccountLabel(id, label);

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    return res.json({ message: "Label updated", account });
  } catch (error) {
    console.error("updateLabel error:", error.message);
    return res.status(500).json({ error: "Failed to update label" });
  }
};

// ─── PATCH /api/accounts/:id/toggle ──────────────────
export const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await accountsService.toggleAccountStatus(id);

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    return res.json({
      message: `Account ${account.is_active ? "activated" : "deactivated"}`,
      account,
    });
  } catch (error) {
    console.error("toggleStatus error:", error.message);
    return res.status(500).json({ error: "Failed to toggle account status" });
  }
};

// ─── DELETE /api/accounts/:id ────────────────────────
export const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    await accountsService.deleteAccount(id);
    return res.json({ message: "Account deleted successfully" });
  } catch (error) {
    if (error.message === "ACCOUNT_IN_USE") {
      return res.status(409).json({
        error:
          "Cannot delete an account that has been used in a batch. Deactivate it instead.",
      });
    }

    console.error("deleteAccount error:", error.message);
    return res.status(500).json({ error: "Failed to delete account" });
  }
};
