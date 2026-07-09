import axios from "axios";
import { getTargetUnitId } from "@/services/targetUnitScope";
import { getApiBaseUrl } from "@/utils/runtimeEnv";

const apiBaseUrl = getApiBaseUrl();

const httpClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

let refreshPromise = null;

httpClient.interceptors.request.use((config) => {
  if (config.skipTargetUnitHeader) {
    return config;
  }
  const id = getTargetUnitId();
  if (id != null) {
    const headers = config.headers ?? {};
    if (typeof headers.set === "function") {
      headers.set("X-Target-Unit-Id", String(id));
      config.headers = headers;
    } else {
      config.headers = { ...headers, "X-Target-Unit-Id": String(id) };
    }
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url || "";
    const isAuthRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/current-user") ||
      requestUrl.includes("/auth/refresh-token") ||
      requestUrl.includes("/auth/verify-email") ||
      requestUrl.includes("/auth/forgot-password") ||
      requestUrl.includes("/auth/reset-password") ||
      requestUrl.includes("/auth/change-password");

    if (status !== 401 || !originalRequest || originalRequest._retry || isAuthRequest) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axios.post(
          `${apiBaseUrl}/auth/refresh-token`,
          {},
          {
            withCredentials: true,
          },
        );
      }

      await refreshPromise;
      return httpClient(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  },
);

export default httpClient;
