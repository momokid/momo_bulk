// packages/server/src/modules/momo/accounts.service.js

import { randomUUID } from "crypto";
import axios from "axios";
import pool from "../../config/database.js";
import { encrypt, decrypt } from "../../utils/encryption.js";
import { env } from "../../config/env.js";
import { clearTokenCache } from "./momo.service.js";

// ─── Provision API credentials with MTN ───────────────────────────────────────

const provisionWithMTN = async (environment) => {
  const apiUserUUID = randomUUID();
  const baseUrl = env.mtn.baseUrl;
  const subKey = env.mtn.subscriptionKey;

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
  if (createRes.status !== 201)
    throw new Error("Failed to create API User with MTN");

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
  if (keyRes.status !== 201)
    throw new Error("Failed to generate API Key with MTN");

  return { apiUser: apiUserUUID, apiKey: keyRes.data.apiKey };
};

// ─── Create Account (one per user) ───────────────────────────────────────────

export const createAccount = async ({
  userId,
  label,
  accountNumber,
  environment,
}) => {
  // One account per user
  const [userAcct] = await pool.query(
    "SELECT id FROM momo_accounts WHERE user_id = ?",
    [userId],
  );
  if (userAcct.length > 0) throw new Error("ACCOUNT_EXISTS");

  // No duplicate account numbers across the system
  const [duplicate] = await pool.query(
    "SELECT id FROM momo_accounts WHERE account_number = ?",
    [accountNumber],
  );
  if (duplicate.length > 0) throw new Error("DUPLICATE_ACCOUNT");

  const { apiUser, apiKey } = await provisionWithMTN(environment);

  const [result] = await pool.query(
    `INSERT INTO momo_accounts
       (user_id, label, account_number, api_user, api_key, environment)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      label,
      accountNumber,
      encrypt(apiUser),
      encrypt(apiKey),
      environment || "sandbox",
    ],
  );

  return getAccountById(result.insertId);
};

// ─── Get User's Account (no credentials — for UI display) ─────────────────────

export const getUserAccount = async (userId) => {
  const [rows] = await pool.query(
    `SELECT id, label, account_number, environment, is_active, created_at
     FROM momo_accounts WHERE user_id = ?`,
    [userId],
  );
  return rows[0] || null;
};

// ─── Get Active Account with credentials (for internal MTN API calls) ─────────

export const getActiveAccount = async (userId) => {
  const [rows] = await pool.query(
    `SELECT * FROM momo_accounts WHERE user_id = ? AND is_active = 1`,
    [userId],
  );
  if (rows.length === 0) return null;
  const account = rows[0];
  return {
    ...account,
    api_user: decrypt(account.api_user),
    api_key: decrypt(account.api_key),
  };
};

// ─── Get Account By ID — internal use only (transfers, momo service) ──────────

export const getAccountById = async (id) => {
  const [rows] = await pool.query("SELECT * FROM momo_accounts WHERE id = ?", [
    id,
  ]);
  if (rows.length === 0) return null;
  const account = rows[0];
  return {
    ...account,
    api_user: decrypt(account.api_user),
    api_key: decrypt(account.api_key),
  };
};

// ─── Update Label ─────────────────────────────────────────────────────────────

export const updateAccountLabel = async (id, userId, label) => {
  await pool.query(
    "UPDATE momo_accounts SET label = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [label, new Date(), id, userId],
  );
  return getAccountById(id);
};

// ─── Toggle Active Status ─────────────────────────────────────────────────────

export const toggleAccountStatus = async (id, userId) => {
  await pool.query(
    "UPDATE momo_accounts SET is_active = NOT is_active, updated_at = ? WHERE id = ? AND user_id = ?",
    [new Date(), id, userId],
  );
  return getAccountById(id);
};

// ─── Delete Account ───────────────────────────────────────────────────────────

export const deleteAccount = async (id, userId) => {
  const [batches] = await pool.query(
    "SELECT id FROM batches WHERE momo_account_id = ? LIMIT 1",
    [id],
  );
  if (batches.length > 0) throw new Error("ACCOUNT_IN_USE");

  clearTokenCache(id);
  await pool.query("DELETE FROM momo_accounts WHERE id = ? AND user_id = ?", [
    id,
    userId,
  ]);
};
