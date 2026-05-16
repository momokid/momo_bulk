import api from "./api.js";

// ─── POST /api/auth/register ──────────────────────────────────────────────────

export const register = async (email, password) => {
  const { data } = await api.post("/api/auth/register", { email, password });
  return data;
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

export const login = async (email, password) => {
  const { data } = await api.post("/api/auth/login", { email, password });
  return data;
};

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

export const logout = async () => {
  const { data } = await api.post("/api/auth/logout");
  return data;
};

// ─── POST /api/auth/accept-terms ──────────────────────────────────────────────
// Access token attached automatically by the request interceptor in api.js

export const acceptTerms = async () => {
  const { data } = await api.post("/api/auth/accept-terms");
  return data;
};
