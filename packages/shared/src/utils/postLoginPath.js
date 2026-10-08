/**
 * Tránh open redirect sau đăng nhập (chỉ cho phép đường dẫn nội bộ).
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function safeInternalPath(raw) {
  if (raw == null || typeof raw !== "string") {
    return "/";
  }
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) {
    return "/";
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

/**
 * Đích sau login mật khẩu (path nội bộ app chính).
 * Superadmin luôn vào trang chọn — bỏ qua `from`.
 */
export function resolvePostLoginPath(user, fromRaw, origins = {}) {
  if (isSuperadminUser(user)) {
    return SUPERADMIN_PORTAL_CHOOSER_PATH;
  }
  if (isLttpSupplierUser(user)) {
    const origin = String(origins.supplierOrigin || "http://localhost:3002").replace(/\/+$/, "");
    return `${origin}/dat-hang`;
  }
  return safeInternalPath(fromRaw);
}
