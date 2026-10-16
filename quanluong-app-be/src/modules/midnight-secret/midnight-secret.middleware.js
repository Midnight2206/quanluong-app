import crypto from "crypto";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

/**
 * Bảo vệ API báo cáo nội bộ: header `X-Midnight-Secret` phải khớp `MIDNIGHT_SECRET_PASSWORD`.
 */
function midnightSecretMiddleware(req, res, next) {
  const expected = process.env.MIDNIGHT_SECRET_PASSWORD;
  if (expected == null || String(expected).trim() === "") {
    return next(
      new AppError({
        message: "MIDNIGHT_SECRET_PASSWORD chưa cấu hình trên server",
        statusCode: 503,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      }),
    );
  }
  const expBuf = Buffer.from(String(expected), "utf8");
  const gotBuf = Buffer.from(String(req.get("x-midnight-secret") ?? ""), "utf8");
  if (expBuf.length !== gotBuf.length || !crypto.timingSafeEqual(expBuf, gotBuf)) {
    return res.status(401).json({
      success: false,
      error: { message: "Không hợp lệ" },
    });
  }
  next();
}

function midnightUserUnitMiddleware(req, _res, next) {
  const fromUser = Number(req.user?.unitId ?? req.user?.unit?.id);
  const fromHeader = Number(req.get("x-midnight-user-unit-id"));
  if (Number.isInteger(fromUser) && fromUser > 0) {
    req.midnightUserUnitId = fromUser;
    return next();
  }
  if (Number.isInteger(fromHeader) && fromHeader > 0) {
    req.midnightUserUnitId = fromHeader;
    return next();
  }
  // Superadmin không gắn đơn vị: cho qua để GET /units liệt kê; API còn lại tự kiểm tra.
  if (req.user?.type?.name === "superadmin") {
    req.midnightUserUnitId = null;
    return next();
  }
  return next(
    new AppError({
      message: "Không xác định được đơn vị của user đang truy cập",
      statusCode: 401,
      code: ERROR_CODES.UNAUTHORIZED,
    }),
  );
}

export { midnightSecretMiddleware, midnightUserUnitMiddleware };
