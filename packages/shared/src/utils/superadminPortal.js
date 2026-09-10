import {
  getMainAppOriginEnv,
  getSuperadminOriginEnv,
} from "./runtimeEnv.js";

/**
 * Origin cổng superadmin (sidebar «Quản trị hệ thống», redirect sau đăng nhập superadmin).
 *
 * - Trên trình duyệt: suy từ URL hiện tại (ưu tiên hơn bake-in localhost từ Docker build).
 * - Env `NEXT_PUBLIC_SUPERADMIN_ORIGIN` / `NEXT_PUBLIC_MAIN_APP_ORIGIN` chỉ dùng khi
 *   không phải localhost bake-in trên host công khai, hoặc khi SSR không có `window`.
 * - Docker :8080 → :8081, Next :3000 → :3001,
 *   `quanluong.example.com` → `admin-quanluong.example.com`.
 */
function trimOrigin(value) {
  return String(value).replace(/\/+$/, "");
}

function isLocalhostHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isLocalhostOrigin(origin) {
  try {
    return isLocalhostHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function portSuffix(port) {
  if (!port || port === "80" || port === "443") {
    return "";
  }
  return `:${port}`;
}

function defaultSuperadminOriginFromWindow() {
  if (typeof window === "undefined") {
    return "http://localhost:3001";
  }
  const { protocol, hostname, port } = window.location;
  if (port === "8080") {
    return `${protocol}//${hostname}:8081`;
  }
  if (port === "3000") {
    return `${protocol}//${hostname}:3001`;
  }
  // Prod subdomain: quanluong.trankhanhan.site → admin-quanluong.trankhanhan.site
  if (hostname && !hostname.startsWith("admin-") && !isLocalhostHost(hostname)) {
    return `${protocol}//admin-${hostname}${portSuffix(port)}`;
  }
  return "http://localhost:3001";
}

function defaultMainOriginFromWindow() {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }
  const { protocol, hostname, port } = window.location;
  if (port === "8081") {
    return `${protocol}//${hostname}:8080`;
  }
  if (port === "3001") {
    return `${protocol}//${hostname}:3000`;
  }
  if (hostname.startsWith("admin-")) {
    return `${protocol}//${hostname.slice("admin-".length)}${portSuffix(port)}`;
  }
  return "http://localhost:3000";
}

/** Env bake-in localhost không được đè khi đang mở host thật (prod / LAN). */
function preferEnvOrigin(raw) {
  if (!raw) {
    return undefined;
  }
  if (typeof window === "undefined") {
    return trimOrigin(raw);
  }
  if (isLocalhostOrigin(raw) && !isLocalhostHost(window.location.hostname)) {
    return undefined;
  }
  return trimOrigin(raw);
}

export function getSuperadminAppOrigin() {
  const fromEnv = preferEnvOrigin(getSuperadminOriginEnv());
  if (fromEnv) {
    return fromEnv;
  }
  return defaultSuperadminOriginFromWindow();
}

export function getMainAppOrigin() {
  const fromEnv = preferEnvOrigin(getMainAppOriginEnv());
  if (fromEnv) {
    return fromEnv;
  }
  return defaultMainOriginFromWindow();
}

/** @visibleForTesting */
export const __testables = {
  defaultSuperadminOriginFromWindow,
  defaultMainOriginFromWindow,
  preferEnvOrigin,
  isLocalhostOrigin,
};
