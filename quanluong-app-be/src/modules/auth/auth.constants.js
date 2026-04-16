import { config } from "../../config/config.js";
import { accessTokenExpiresInToCookieMaxAgeMs } from "./access-token-cookie-max-age.js";

const AUTH_COOKIE_NAMES = {
  ACCESS_TOKEN: config.auth.accessTokenCookieName,
  REFRESH_TOKEN: config.auth.refreshTokenCookieName,
};

const refreshDays =
  Number.isFinite(config.auth.refreshTokenExpiresDays) && config.auth.refreshTokenExpiresDays > 0
    ? config.auth.refreshTokenExpiresDays
    : 30;

const ACCESS_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: config.app.isProduction,
  path: "/",
  maxAge: accessTokenExpiresInToCookieMaxAgeMs(config.auth.accessTokenExpiresIn),
};

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  ...ACCESS_TOKEN_COOKIE_OPTIONS,
  maxAge: refreshDays * 24 * 60 * 60 * 1000,
};

const REFRESH_TOKEN_CLEANUP_SCHEDULE = "0 3 * * *";

export {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_CLEANUP_SCHEDULE,
  REFRESH_TOKEN_COOKIE_OPTIONS,
};
