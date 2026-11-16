import { getMainAppOriginEnv, getSupplierOriginEnv } from "./runtimeEnv.js";

/** Trang chủ NCC = trang chủ gốc app (không phải cổng riêng). */
export const SUPPLIER_DEFAULT_HOME = "/";

/** @deprecated Dùng SUPPLIER_DEFAULT_HOME — giữ alias cho chỗ cũ. */
export const SUPPLIER_APP_BASE = SUPPLIER_DEFAULT_HOME;

export const SUPPLIER_ORDER_PATH = "/ncc-dathang";
export const SUPPLIER_LEDGER_PATH = "/ncc-congno";
export const SUPPLIER_INVOICE_PATH = "/ncc-hoadon";

const SUPPLIER_FEATURE_PATHS = [
  SUPPLIER_ORDER_PATH,
  SUPPLIER_LEDGER_PATH,
  SUPPLIER_INVOICE_PATH,
];

const SUPPLIER_SUB_PATHS = {
  "dat-hang": SUPPLIER_ORDER_PATH,
  dathang: SUPPLIER_ORDER_PATH,
  "so-cong-no": SUPPLIER_LEDGER_PATH,
  "cong-no": SUPPLIER_LEDGER_PATH,
  congno: SUPPLIER_LEDGER_PATH,
  "hoa-don": SUPPLIER_INVOICE_PATH,
  hoadon: SUPPLIER_INVOICE_PATH,
  settings: "/settings",
  profile: "/profile",
};

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

/**
 * Path NCC: không sub → trang chủ `/`; sub → path phẳng (`dat-hang` → `/ncc-dathang`).
 * @param {string} [sub]
 */
export function supplierPath(sub = "") {
  const s = String(sub || "").replace(/^\/+/, "");
  if (!s) {
    return SUPPLIER_DEFAULT_HOME;
  }
  return SUPPLIER_SUB_PATHS[s] || `/${s}`;
}

/** Path nghiệp vụ NCC (`/ncc-dathang` …) hoặc legacy `/ncc/...`. */
export function isSupplierAppPath(pathname) {
  const p = String(pathname || "");
  if (SUPPLIER_FEATURE_PATHS.some((base) => p === base || p.startsWith(`${base}/`))) {
    return true;
  }
  // Legacy nested `/ncc` (redirects vẫn có thể trỏ tạm).
  return p === "/ncc" || p.startsWith("/ncc/");
}

/**
 * Zalo portal: supplier khi path/from là route NCC.
 * @param {{ pathname?: string | null, from?: string | null }} [ctx]
 */
export function resolveZaloPortal(ctx = {}) {
  if (isSupplierAppPath(ctx.pathname) || isSupplierAppPath(ctx.from)) {
    return "supplier";
  }
  return "main";
}

/**
 * Origin UI cho NCC — cùng origin app chính.
 */
export function getSupplierAppOrigin() {
  const main = preferEnvOrigin(getMainAppOriginEnv());
  if (main) {
    return main;
  }
  const legacy = preferEnvOrigin(getSupplierOriginEnv());
  if (legacy) {
    return legacy;
  }
  if (typeof window === "undefined") {
    return "http://localhost:8080";
  }
  return window.location.origin;
}
