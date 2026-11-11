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
  // Trang marketing `/` không còn là đích sau login.
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
 * Cookie phiên là host-only trừ khi COOKIE_DOMAIN phủ cả hai host — Tailscale `*.ts.net`
 * là public suffix nên không share được. Đẩy superadmin sang host kia rồi bị đá về
 * sẽ thành vòng lặp.
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
 * Superadmin trên app chính vào trang chọn, không vào `/dashboard` (app chính đá sang cổng kia).
 * Trên chính cổng superadmin thì `/dashboard` là đúng và cùng host.
 * @param {object | null | undefined} user
 * @param {{ hostname?: string, port?: string } | null | undefined} [loc]
 */
export function publicOnlyRedirectPath(user, loc) {
  if (isSuperadminUser(user)) {
    return isSuperadminBrowserHost(loc) ? DEFAULT_APP_HOME : SUPERADMIN_PORTAL_CHOOSER_PATH;
  }
  return DEFAULT_APP_HOME;
}

export function supplierChooserHandoff(user, supplierOrigin) {
  if (isLttpSupplierUser(user)) {
    return {
      external: `${String(supplierOrigin).replace(/\/+$/, "")}/`,
    };
  }
  if (isSuperadminUser(user)) {
    return { stay: true };
  }
  return { internal: "/dashboard" };
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
    return `${origin}/`;
  }
  return safeInternalPath(fromRaw);
}
