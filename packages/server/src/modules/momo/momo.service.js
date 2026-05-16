import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { env } from "../../config/env.js";
import { decrypt } from "../../utils/encryption.js";

// ─── Token Cache ─────────────────────────────────────
// Stored in memory per account — keyed by account id
const tokenCache = {};

const getAccessToken = async (account) => {
  const cached = tokenCache[account.id];
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.token;
  }

  const apiUser = account.api_user;
  const apiKey = account.api_key;

  const credentials = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");

  const response = await axios.post(
    `${env.mtn.baseUrl}/disbursement/token/`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Ocp-Apim-Subscription-Key": env.mtn.subscriptionKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  const { access_token, expires_in } = response.data;

  // Cache token with expiry (expires_in is in seconds)
  tokenCache[account.id] = {
    token: access_token,
    expiresAt: now + expires_in * 1000,
  };

  return access_token;
};

// ─── Verify Account Holder Name ──────────────────────
export const verifyAccountName = async (account, phoneNumber) => {
  try {
    // Normalize Ghana numbers to international format (0XXXXXXXXX → 233XXXXXXXXX)
    const msisdn = phoneNumber.startsWith("0")
      ? `233${phoneNumber.slice(1)}`
      : phoneNumber;

    const token = await getAccessToken(account);

    const response = await axios.get(
      `${env.mtn.baseUrl}/disbursement/v1_0/accountholder/msisdn/${msisdn}/basicuserinfo`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": env.mtn.subscriptionKey,
          "X-Target-Environment": account.environment,
        },
      },
    );

    const fullName =
      response.data.name ||
      `${response.data.given_name || ""} ${response.data.family_name || ""}`.trim();

    return {
      success: true,
      name: fullName,
    };

    return {
      success: true,
      name: response.data.name,
    };
  } catch (error) {
    const status = error.response?.status;

    // Temporary: log full error for debugging
    console.error("verifyAccountName error:", {
      status,
      data: error.response?.data,
      message: error.message,
    });

    if (status === 404) {
      return { success: false, reason: "NOT_FOUND" };
    }

    if (status === 400) {
      return { success: false, reason: "INVALID_NUMBER" };
    }

    return { success: false, reason: "API_ERROR" };
  }
};

// ─── Disburse (Send Money) ───────────────────────────
export const disburse = async (
  account,
  { phone, amount, externalId, payerMessage, payeeNote },
) => {
  try {
    // Normalize Ghana numbers to international format (0XXXXXXXXX → 233XXXXXXXXX)
    const msisdn = phone.startsWith("0") ? `233${phone.slice(1)}` : phone;

    const token = await getAccessToken(account);
    const referenceId = uuidv4();

    await axios.post(
      `${env.mtn.baseUrl}/disbursement/v1_0/transfer`,
      {
        amount: String(amount),
        currency: env.mtn.currency,
        externalId,
        payee: {
          partyIdType: "MSISDN",
          partyId: msisdn,
        },
        payerMessage: payerMessage || "Payment",
        payeeNote: payeeNote || "Payment",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": env.mtn.subscriptionKey,
          "X-Reference-Id": referenceId,
          "X-Target-Environment": account.environment,
          "Content-Type": "application/json",
        },
      },
    );

    return { success: true, referenceId };
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || "Unknown error";

    return { success: false, status, message };
  }
};

// ─── Get Transfer Status ─────────────────────────────
export const getTransferStatus = async (account, referenceId) => {
  try {
    const token = await getAccessToken(account);

    const response = await axios.get(
      `${env.mtn.baseUrl}/disbursement/v1_0/transfer/${referenceId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": env.mtn.subscriptionKey,
          "X-Target-Environment": account.environment,
        },
      },
    );

    const { status, reason } = response.data;

    return {
      success: true,
      status, // SUCCESSFUL, FAILED, PENDING
      reason,
    };
  } catch (error) {
    return {
      success: false,
      status: "UNKNOWN",
      reason: error.response?.data?.message || "API_ERROR",
    };
  }
};

// ─── Clear Token Cache for an Account ───────────────
// Called when account credentials are updated
export const clearTokenCache = (accountId) => {
  delete tokenCache[accountId];
};
