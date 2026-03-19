/**
 * api.js — Centralised Axios instance.
 * - Attaches Bearer token to every request automatically.
 * - Retries transient failures (5xx, network errors) up to 2 times.
 * - Clears auth state on 401 so the app redirects to login.
 */
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach token ────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("cybermind_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    config._retryCount = config._retryCount || 0;
    return config;
  },
  (err) => Promise.reject(err)
);

// ── Response interceptor: retry on 5xx/network, clear auth on 401 ───────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;

    // Clear auth on 401
    if (err.response?.status === 401) {
      localStorage.removeItem("cybermind_token");
      localStorage.removeItem("cybermind_user");
      return Promise.reject(err);
    }

    // Retry on network errors or 5xx responses
    const isRetryable =
      !err.response ||                        // network error
      err.response.status >= 500;             // server error

    if (isRetryable && config && config._retryCount < MAX_RETRIES) {
      config._retryCount += 1;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * config._retryCount));
      return api(config);
    }

    return Promise.reject(err);
  }
);

export default api;
