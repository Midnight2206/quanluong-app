import axios from "axios";
import { session } from "./session";

/**
 * ============================================
 * CONFIG
 * ============================================
 */
const baseURL = import.meta.env.VITE_BASE_API;

/**
 * ============================================
 * AXIOS INSTANCE
 * ============================================
 */
const httpClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
});

/**
 * ============================================
 * REFRESH STATE
 * ============================================
 */
let isRefreshing = false;
let failedQueue = [];

/**
 * Resolve queue sau khi refresh xong
 */
const resolveQueue = (error = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
};

/**
 * ============================================
 * REFRESH TOKEN
 * ============================================
 */
const refreshToken = async () => {
  try {
    await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error("SESSION_EXPIRED");
    }
    throw error;
  }
};

/**
 * ============================================
 * RESPONSE INTERCEPTOR
 * ============================================
 */
httpClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // ❌ Lỗi network
    if (!error.response) {
      return Promise.reject(error);
    }

    const isUnauthorized = error.response.status === 401;
    const requestUrl = String(originalRequest.url || "");

    const isAuthRoute =
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register");

    const skipRefresh = Boolean(originalRequest?.skipRefresh);

    // ❌ Không xử lý refresh trong các case này
    if (
      !isUnauthorized ||
      isAuthRoute ||
      originalRequest._retry ||
      skipRefresh
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    /**
     * ========================================
     * CASE 1: CHƯA REFRESH → REFRESH NGAY
     * ========================================
     */
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        await refreshToken();

        // resolve các request đang chờ
        resolveQueue();

        // retry request cũ
        return httpClient(originalRequest);
      } catch (refreshError) {
        // reject tất cả queue
        resolveQueue(refreshError);

        // 🔥 SESSION EXPIRED → LOGOUT
        if (refreshError.message === "SESSION_EXPIRED") {
          session.logout();
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    /**
     * ========================================
     * CASE 2: ĐANG REFRESH → ĐƯA VÀO QUEUE
     * ========================================
     */
    return new Promise((resolve, reject) => {
      failedQueue.push({
        resolve: () => resolve(httpClient(originalRequest)),
        reject,
      });
    });
  },
);

/**
 * ============================================
 * REQUEST HELPER
 * ============================================
 */
const sendRequest = async (method, url, data, config = {}) => {
  const response = await httpClient.request({
    method,
    url,
    data,
    ...config,
  });

  return response.data;
};

/**
 * ============================================
 * EXPORT API
 * ============================================
 */
const http = {
  get: (url, config) => sendRequest("get", url, null, config),
  post: (url, data, config) => sendRequest("post", url, data, config),
  put: (url, data, config) => sendRequest("put", url, data, config),
  patch: (url, data, config) => sendRequest("patch", url, data, config),
  delete: (url, config) => sendRequest("delete", url, null, config),
};

export default http;
