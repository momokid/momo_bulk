import { randomUUID } from "crypto";
import axios from "axios";
import pool from "../../config/database.js";
import { encrypt, decrypt } from "../../utils/encryption.js";
import { env } from "../../config/env.js";
import { clearTokenCache } from "./momo.service.js";

// ─── Provision API credentials with MTN ──────────────
const provisionWithMTN = async (environment) => {
  const apiUserUUID = randomUUID();
  const baseUrl = env.mtn.baseUrl;
  const subKey = env.mtn.subscriptionKey;

  // Step 1 — Create API User
  const createRes = await axios.post(
    `${baseUrl}/v1_0/apiuser`,
    { providerCallbackHost: "localhost" },
    {
      headers: {
        "X-Reference-Id": apiUserUUID,
        "Ocp-Apim-Subscription-Key": subKey,
        "Content-Type": "application/json",
      },
    },
  );

  if (createRes.status !== 201) {
    throw new Error("Failed to create API User with MTN");
  }

  // Step 2 — Generate API Key
  const keyRes = await axios.post(
    `${baseUrl}/v1_0/apiuser/${apiUserUUID}/apikey`,
    {},
    {
      headers: {
        "Ocp-Apim-Subscription-Key": subKey,
        "Content-Type": "application/json",
      },
    },
  );

  if (keyRes.status !== 201) {
    throw new Error("Failed to generate API Key with MTN");
  }

  return {
    apiUser: apiUserUUID,
    apiKey: keyRes.data.apiKey,
  };
};

// ─── Create Account ───────────────────────────────────
export const createAccount = async ({ label, accountNumber, environment }) => {
  // Check for duplicate account number
  const [existing] = await pool.query(
    "SELECT id FROM momo_accounts WHERE account_number = ?",
    [accountNumber],
  );

  if (existing.length > 0) {
    throw new Error("DUPLICATE_ACCOUNT");
  }

  // Provision with MTN
  const { apiUser, apiKey } = await provisionWithMTN(environment);

  // Encrypt credentials before storing
  const [result] = await pool.query(
    `INSERT INTO momo_accounts (label, account_number, api_user, api_key, environment)
     VALUES (?, ?, ?, ?, ?)`,
    [
      label,
      accountNumber,
      encrypt(apiUser),
      encrypt(apiKey),
      environment || "sandbox",
    ],
  );

  return getAccountById(result.insertId);
};

// ─── Get All Accounts ─────────────────────────────────
export const getAllAccounts = async () => {
  const [rows] = await pool.query(
    `SELECT id, label, account_number, environment, is_active, created_at
     FROM momo_accounts
     ORDER BY created_at DESC`,
  );
  return rows;
};

// ─── Get Account By ID (with decrypted credentials) ──
export const getAccountById = async (id) => {
  const [rows] = await pool.query(`SELECT * FROM momo_accounts WHERE id = ?`, [
    id,
  ]);

  if (rows.length === 0) return null;

  const account = rows[0];

  // Return decrypted credentials for API calls
  return {
    ...account,
    api_user: decrypt(account.api_user),
    api_key: decrypt(account.api_key),
  };
};

// ─── Update Label ─────────────────────────────────────
export const updateAccountLabel = async (id, label) => {
  await pool.query("UPDATE momo_accounts SET label = ? WHERE id = ?", [
    label,
    id,
  ]);
  return getAccountById(id);
};

// ─── Toggle Active Status ─────────────────────────────
export const toggleAccountStatus = async (id) => {
  await pool.query(
    "UPDATE momo_accounts SET is_active = NOT is_active WHERE id = ?",
    [id],
  );
  return getAccountById(id);
};

// ─── Delete Account ───────────────────────────────────
export const deleteAccount = async (id) => {
  // Check if account has been used in any batch
  const [batches] = await pool.query(
    "SELECT id FROM batches WHERE momo_account_id = ? LIMIT 1",
    [id],
  );

  if (batches.length > 0) {
    throw new Error("ACCOUNT_IN_USE");
  }

  clearTokenCache(id);
  await pool.query("DELETE FROM momo_accounts WHERE id = ?", [id]);
};
