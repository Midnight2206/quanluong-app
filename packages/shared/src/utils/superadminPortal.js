import {
  getMainAppOriginEnv,
  getSuperadminOriginEnv,
} from "@/utils/runtimeEnv";

/**
 * Origin cổng superadmin (sidebar «Quản trị hệ thống», redirect sau đăng nhập superadmin).
 *
 * - Ưu tiên biến môi trường Next: `NEXT_PUBLIC_SUPERADMIN_ORIGIN` / `NEXT_PUBLIC_MAIN_APP_ORIGIN`.
 * - Nếu không có: suy từ cổng hiện tại — Docker :8080 → :8081, Next dev :3000 → :3001.
 */
function trimOrigin(value) {
  return String(value).replace(/\/+$/, "");
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
  return "http://localhost:3000";
}

export function getSuperadminAppOrigin() {
  const raw = getSuperadminOriginEnv();
  if (raw) {
    return trimOrigin(raw);
  }
  return defaultSuperadminOriginFromWindow();
}

export function getMainAppOrigin() {
  const raw = getMainAppOriginEnv();
  if (raw) {
    return trimOrigin(raw);
  }
  return defaultMainOriginFromWindow();
}
