import {
  isSupplierAppPath,
  SUPPLIER_DEFAULT_HOME,
  supplierPath,
} from "./supplierPortal.js";

/**
 * Tránh open redirect sau đăng nhập (chỉ cho phép đường dẫn nội bộ).
 * @param {string | null | undefined} raw
 * @returns {string}
 */
const DEFAULT_APP_HOME = "/dashboard";

export function safeInternalPath(raw) {
  if (raw == null || typeof raw !== "string") {
    return DEFAULT_APP_HOME;
  }
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) {
    return DEFAULT_APP_HOME;
  }
  // Trang marketing `/` không còn là đích sau login (user thường).
  if (t === "/") {
    return DEFAULT_APP_HOME;
  }
  return t;
}

export const SUPERADMIN_PORTAL_CHOOSER_PATH = "/chon-cong";

export function isSuperadminUser(user) {
  return user?.type?.name === "superadmin";
}

export function isLttpSupplierUser(user) {
  return user?.type?.name === "lttp_supplier";
}

export function navigateAfterLogin(next, { assign, replace }) {
  if (/^https?:\/\//i.test(next)) {
    assign(next);
    return;
  }
  replace(next);
}

/**
 * Host đang mở cổng superadmin (subdomain `admin-` hoặc cổng dev 3001/8081).
 * @param {{ hostname?: string, port?: string } | null | undefined} loc
 */
export function isSuperadminBrowserHost(loc) {
  if (!loc) {
    return false;
  }
  const hostname = String(loc.hostname || "");
  const port = String(loc.port || "");
  if (hostname.startsWith("admin-")) {
    return true;
  }
  return port === "8081" || port === "3001";
}

/**
 * Đích khi user đã đăng nhập mà đang đứng trên trang public (login).
 * NCC về trang chủ gốc `/`.
 */
export function publicOnlyRedirectPath(user, loc) {
  if (isSuperadminUser(user)) {
    return isSuperadminBrowserHost(loc) ? DEFAULT_APP_HOME : SUPERADMIN_PORTAL_CHOOSER_PATH;
  }
  if (isLttpSupplierUser(user)) {
    return SUPPLIER_DEFAULT_HOME;
  }
  return DEFAULT_APP_HOME;
}

/**
 * @param {object | null | undefined} user
 * @param {string} [_supplierOrigin] legacy unused
 */
export function supplierChooserHandoff(user, _supplierOrigin) {
  if (isLttpSupplierUser(user)) {
    return { internal: SUPPLIER_DEFAULT_HOME };
  }
  if (isSuperadminUser(user)) {
    return { stay: true };
  }
  return { internal: "/dashboard" };
}

/**
 * Đích sau login mật khẩu.
 * Superadmin → chọn cổng. NCC → `/` (hoặc `from` nếu là path NCC / profile).
 */
export function resolvePostLoginPath(user, fromRaw, _origins = {}) {
  if (isSuperadminUser(user)) {
    return SUPERADMIN_PORTAL_CHOOSER_PATH;
  }
  if (isLttpSupplierUser(user)) {
    const raw = typeof fromRaw === "string" ? fromRaw.trim() : "";
    if (raw === "/" || raw === SUPPLIER_DEFAULT_HOME) {
      return SUPPLIER_DEFAULT_HOME;
    }
    if (raw.startsWith("/") && !raw.startsWith("//")) {
      // Legacy nested `/ncc/...` → path phẳng
      if (raw === "/ncc" || raw.startsWith("/ncc/")) {
        if (raw === "/ncc/dat-hang" || raw.startsWith("/ncc/dat-hang/")) {
          return supplierPath("dat-hang");
        }
        if (raw === "/ncc/so-cong-no" || raw.startsWith("/ncc/so-cong-no/")) {
          return supplierPath("so-cong-no");
        }
        return SUPPLIER_DEFAULT_HOME;
      }
      if (isSupplierAppPath(raw) || raw === "/profile" || raw.startsWith("/profile/")) {
        return raw;
      }
    }
    return SUPPLIER_DEFAULT_HOME;
  }
  return safeInternalPath(fromRaw);
}
