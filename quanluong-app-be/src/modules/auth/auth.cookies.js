import {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from "./auth.constants.js";

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN, accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
  res.cookie(AUTH_COOKIE_NAMES.REFRESH_TOKEN, refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
}

export { setAuthCookies };
