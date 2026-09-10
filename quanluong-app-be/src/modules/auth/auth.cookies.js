import {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from "./auth.constants.js";

/** Options tối thiểu để clearCookie khớp cookie đã set (Express cần path/domain/sameSite/secure). */
function clearOpts(extra = {}) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: ACCESS_TOKEN_COOKIE_OPTIONS.sameSite ?? "lax",
    secure: Boolean(ACCESS_TOKEN_COOKIE_OPTIONS.secure),
    ...extra,
  };
}

/**
 * Xóa cả host-only (cookie cũ trước khi bật COOKIE_DOMAIN) và bản Domain=.parent.
 */
function clearAuthCookies(res) {
  const names = [AUTH_COOKIE_NAMES.ACCESS_TOKEN, AUTH_COOKIE_NAMES.REFRESH_TOKEN];
  for (const name of names) {
    res.clearCookie(name, clearOpts());
    if (ACCESS_TOKEN_COOKIE_OPTIONS.domain) {
      res.clearCookie(name, clearOpts({ domain: ACCESS_TOKEN_COOKIE_OPTIONS.domain }));
    }
  }
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN, accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
  res.cookie(AUTH_COOKIE_NAMES.REFRESH_TOKEN, refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
  // Gỡ bản host-only trùng tên (trước khi bật COOKIE_DOMAIN) — không clear Domain trước Set.
  if (ACCESS_TOKEN_COOKIE_OPTIONS.domain) {
    res.clearCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN, clearOpts());
    res.clearCookie(AUTH_COOKIE_NAMES.REFRESH_TOKEN, clearOpts());
  }
}

export { clearAuthCookies, setAuthCookies };
