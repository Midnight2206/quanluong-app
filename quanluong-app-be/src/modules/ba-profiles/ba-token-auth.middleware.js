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

export { createBaTokenAuthMiddleware, requireBaScope };
