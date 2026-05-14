import { verifyAccountName } from "../momo/momo.service.js";
import { getAccountById } from "../momo/accounts.service.js";

// ─── POST /api/sender/verify ──────────────────────────
export const verifySender = async (req, res) => {
  try {
    const { phoneNumber, accountId } = req.body;

    if (!phoneNumber || !accountId) {
      return res.status(400).json({
        error: "Phone number and account ID are required",
      });
    }

    // Sanitise phone number
    const cleaned = phoneNumber.replace(/\s+/g, "");
    if (!/^0[0-9]{9}$/.test(cleaned)) {
      return res.status(400).json({
        error: "Invalid phone number. Must be 10 digits starting with 0",
      });
    }

    // Load account credentials
    const account = await getAccountById(accountId);
    if (!account) {
      return res.status(404).json({ error: "Disbursement account not found" });
    }

    if (!account.is_active) {
      return res
        .status(400)
        .json({ error: "Selected disbursement account is inactive" });
    }

    // Verify name with MTN
    const result = await verifyAccountName(account, cleaned);

    if (!result.success) {
      const messages = {
        NOT_FOUND: "This number is not registered on MTN MoMo",
        INVALID_NUMBER: "Invalid MoMo number",
        API_ERROR: "Could not reach MTN at this time. Please try again.",
      };

      return res.status(400).json({
        error: messages[result.reason] || "Verification failed",
        reason: result.reason,
      });
    }

    return res.json({
      phoneNumber: cleaned,
      name: result.name,
      accountId,
    });
  } catch (error) {
    console.error("verifySender error:", error.message);
    return res.status(500).json({ error: "Sender verification failed" });
  }
};
