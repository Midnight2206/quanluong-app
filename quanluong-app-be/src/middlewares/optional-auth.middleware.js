import { setAuthCookies } from "../modules/auth/auth.cookies.js";
import { AUTH_COOKIE_NAMES } from "../modules/auth/auth.constants.js";
import {
  authenticateAccessToken,
  getUserById,
  refreshSession,
} from "../modules/auth/auth.service.js";

/** Giống authMiddleware nhưng không trả 401 — req.user = null khi chưa đăng nhập. */
async function optionalAuthMiddleware(req, res, next) {
  const accessToken = req.cookies?.[AUTH_COOKIE_NAMES.ACCESS_TOKEN];
  const sessionAuth = req.session?.auth;
  const refreshToken = req.cookies?.[AUTH_COOKIE_NAMES.REFRESH_TOKEN];

  try {
    req.user = await authenticateAccessToken({ accessToken, sessionAuth });
    return next();
  } catch {
    if (!refreshToken) {
      req.user = null;
      return next();
    }
    try {
      const session = await refreshSession({
        req,
        refreshToken,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      setAuthCookies(res, session);
      req.user = await getUserById(session.user.id);
      return next();
    } catch {
      req.user = null;
      return next();
    }
  }
}

export { optionalAuthMiddleware };
