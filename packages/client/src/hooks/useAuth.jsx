// packages/client/src/hooks/useAuth.js

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { setAccessToken, clearAccessToken } from "../services/api.js";
import * as authService from "../services/auth.service.js";
import api from "../services/api.js";

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

// ─── Session storage helpers ──────────────────────────────────────────────────
// Stores user profile only — never the token itself.
// sessionStorage clears on tab close; survives page refresh.

const SESSION_KEY = "momo_user";

const saveUser = (user) => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
};

const loadUser = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const removeUser = () => {
  sessionStorage.removeItem(SESSION_KEY);
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Silent session restore on mount ────────────────
  // The httpOnly refresh cookie may still be valid even after a page refresh.
  // Attempt to get a new access token silently; restore user from sessionStorage.
  useEffect(() => {
    const restore = async () => {
      try {
        const { data } = await api.post("/api/auth/refresh");
        setAccessToken(data.accessToken);

        const saved = loadUser();
        if (saved) {
          setUser(saved);
        } else {
          // Refresh succeeded but no user profile in session —
          // treat as logged out (user will need to log in again)
          clearAccessToken();
        }
      } catch {
        // No valid refresh token — user is not authenticated
        clearAccessToken();
        removeUser();
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  // ── login ───────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);

    setAccessToken(data.accessToken);
    saveUser(data.user);
    setUser(data.user);

    return data;
  }, []);

  // ── register ────────────────────────────────────────
  const register = useCallback(async (email, password) => {
    const data = await authService.register(email, password);

    setAccessToken(data.accessToken);
    saveUser(data.user);
    setUser(data.user);

    return data;
  }, []);

  // ── logout ──────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Continue even if the server call fails
    } finally {
      clearAccessToken();
      removeUser();
      setUser(null);
    }
  }, []);

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
