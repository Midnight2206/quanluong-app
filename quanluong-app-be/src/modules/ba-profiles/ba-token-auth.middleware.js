import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { extractBaBearerToken, hashBaToken } from "./ba-profiles.utils.js";

function unauthorized(message = "Mã khóa BA không hợp lệ hoặc đã bị thu hồi.") {
  return new AppError({ message, statusCode: 401, code: ERROR_CODES.UNAUTHORIZED });
}

/**
 * Xác thực `Authorization: Bearer qlba_...` (tách biệt JWT người dùng).
 * `deps` cho phép test thay thế truy vấn DB.
 */
function createBaTokenAuthMiddleware({ findActiveTokenByHash, touchToken }) {
  return async function baTokenAuthMiddleware(req, _res, next) {
    try {
      const raw = extractBaBearerToken(req.get?.("authorization") ?? req.headers?.authorization);
      if (!raw) return next(unauthorized("Thiếu header Authorization: Bearer qlba_…"));
      const token = await findActiveTokenByHash(hashBaToken(raw));
      if (!token || token.revokedAt) return next(unauthorized());
      req.baToken = token;
      Promise.resolve(touchToken(token.id)).catch(() => {});
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireBaScope(...scopes) {
  return (req, _res, next) => {
    if (!req.baToken || !scopes.includes(req.baToken.scope)) {
      return next(
        new AppError({
          message: "Mã khóa BA không có quyền thao tác này.",
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
        }),
      );
    }
    return next();
  };
}

/**
 * Bearer `qlba_…` → xác thực token; không có → cookie đăng nhập + superadmin,
 * coi như GLOBAL_WRITE (để giao diện superadmin dùng chung route với trợ lý).
 */
function createBaActorAuthMiddleware({ tokenAuth, userAuth, superadminOnly }) {
  return function baActorAuthMiddleware(req, res, next) {
    const header = req.get?.("authorization") ?? req.headers?.authorization;
    if (extractBaBearerToken(header)) return tokenAuth(req, res, next);
    return userAuth(req, res, (err) => {
      if (err) return next(err);
      return superadminOnly(req, res, (err2) => {
        if (err2) return next(err2);
        req.baToken = { id: null, scope: "GLOBAL_WRITE", unitId: null, viaUserId: req.user.id };
        return next();
      });
    });
  };
}

/** Nhãn người thao tác lưu vào DB. */
function baActorLabel(token) {
  if (token?.viaUserId) return `user:${token.viaUserId}`;
  return token?.prefix ? `token:${token.prefix}` : null;
}

export { baActorLabel, createBaActorAuthMiddleware, createBaTokenAuthMiddleware, requireBaScope };
