// packages/client/src/services/api.js

import axios from "axios";

// ─── In-memory access token ───────────────────────────────────────────────────
// Never stored in localStorage — lives only in JS memory for this session.
// Cleared on page refresh (user must re-authenticate via refresh token cookie).

let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const clearAccessToken = () => {
  accessToken = null;
};

// ─── Axios instance ───────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // sends httpOnly refresh token cookie automatically
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Request interceptor — attach access token ────────────────────────────────

api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response interceptor — handle 401 with token refresh ────────────────────
// Uses a queue to avoid sending multiple simultaneous refresh requests.
// If a refresh is already in progress, subsequent 401s wait for it to resolve.

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, and only once per request
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't retry the refresh endpoint itself — avoids infinite loop
    if (originalRequest.url?.includes("/auth/refresh")) {
      clearAccessToken();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the ongoing refresh resolves
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await api.post("/api/auth/refresh");
      const newToken = data.accessToken;

      setAccessToken(newToken);
      processQueue(null, newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAccessToken();
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
