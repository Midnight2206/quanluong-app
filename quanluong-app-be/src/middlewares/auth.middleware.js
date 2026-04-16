import { setAuthCookies } from "../modules/auth/auth.cookies.js";
import { AUTH_COOKIE_NAMES } from "../modules/auth/auth.constants.js";
import {
  authenticateAccessToken,
  getUserById,
  refreshSession,
} from "../modules/auth/auth.service.js";

/**
 * Cookie access (`ql.at`) là session cookie (hết khi đóng trình duyệt); session `ql.sid` và refresh `ql.rt` có maxAge.
 * Khi chỉ còn sid+rt, thử refresh giống axios — tránh 401 trên fetch không qua interceptor (vd. OAuth Drive).
 */
async function authMiddleware(req, res, next) {
  const accessToken = req.cookies?.[AUTH_COOKIE_NAMES.ACCESS_TOKEN];
  const sessionAuth = req.session?.auth;
  const refreshToken = req.cookies?.[AUTH_COOKIE_NAMES.REFRESH_TOKEN];

  try {
    req.user = await authenticateAccessToken({ accessToken, sessionAuth });
    return next();
  } catch (authError) {
    if (!refreshToken) {
      return next(authError);
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
      return next(authError);
    }
  }
}

export { authMiddleware };
