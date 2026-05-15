// packages/server/src/modules/auth/auth.controller.js

import * as authService from "./auth.service.js";
import { env } from "../../config/env.js";

// ─── Cookie config ────────────────────────────────────────────────────────────

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict",
  secure: !env.isDev,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: "/",
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────

export const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await authService.register(email, password, req.ip);

    res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.status(201).json({
      message: "Account created successfully",
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.status === 409) {
      return res.status(409).json({ error: error.message });
    }
    console.error("register error:", error.message);
    return res
      .status(500)
      .json({ error: "Registration failed. Please try again." });
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({
      message: "Login successful",
      accessToken: result.accessToken,
      user: result.user, // termsAcceptedAt null = client redirects to T&C
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.status === 401) {
      return res.status(401).json({ error: error.message });
    }
    if (error.status === 403) {
      return res.status(403).json({ error: error.message });
    }
    console.error("login error:", error.message);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
};

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

export const refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    const result = await authService.refreshToken(token);

    return res.json({ accessToken: result.accessToken });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ error: error.message });
    }
    console.error("refresh error:", error.message);
    return res.status(500).json({ error: "Token refresh failed." });
  }
};

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

export const logout = async (req, res) => {
  try {
    await authService.logout(req.user?.id);

    res.clearCookie("refreshToken", { path: "/" });

    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("logout error:", error.message);
    return res.status(500).json({ error: "Logout failed." });
  }
};

// ─── POST /api/auth/accept-terms ─────────────────────────────────────────────
// Protected — requires authenticate middleware on the route

export const acceptTerms = async (req, res) => {
  try {
    const result = await authService.acceptTerms(req.user.id, req.ip);

    return res.json({
      message: "Terms accepted",
      ...result,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error("acceptTerms error:", error.message);
    return res
      .status(500)
      .json({ error: "Failed to record terms acceptance." });
  }
};
