import {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from "./auth.constants.js";

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN, accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
  res.cookie(AUTH_COOKIE_NAMES.REFRESH_TOKEN, refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
}

/** Phải cùng path/domain với lúc set — đặc biệt khi dùng COOKIE_DOMAIN. */
function clearAuthCookies(res) {
  const opts = {
    path: "/",
    ...(ACCESS_TOKEN_COOKIE_OPTIONS.domain ? { domain: ACCESS_TOKEN_COOKIE_OPTIONS.domain } : {}),
  };
  res.clearCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN, opts);
  res.clearCookie(AUTH_COOKIE_NAMES.REFRESH_TOKEN, opts);
}

export { clearAuthCookies, setAuthCookies };
