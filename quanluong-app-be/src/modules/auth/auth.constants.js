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

const cookieDomainOpts = config.auth.cookieDomain ? { domain: config.auth.cookieDomain } : {};

// Cross-subdomain trên HTTPS: luôn Secure khi có COOKIE_DOMAIN (kể cả NODE_ENV≠production).
const cookieSecure = Boolean(config.app.isProduction || config.auth.cookieDomain);

const ACCESS_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: cookieSecure,
  path: "/",
  maxAge: accessTokenExpiresInToCookieMaxAgeMs(config.auth.accessTokenExpiresIn),
  ...cookieDomainOpts,
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
