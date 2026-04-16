import { AppError } from "../errors/app-error.js";
import { config } from "../config/config.js";
import { logger } from "../shared/utils/logger.js";

/** Chỉ gắn debug/stack khi không phải production (NODE_ENV=production ẩn chi tiết). */
function shouldExposeErrorDebug() {
  if (process.env.FORCE_SECURE_ERRORS === "1" || process.env.FORCE_SECURE_ERRORS === "true") {
    return false;
  }
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  if (config.app.isProduction) {
    return false;
  }
  return true;
}

function errorMiddleware(error, req, res, _next) {
  const statusCode = error.statusCode || 500;
  const code = error.code || "INTERNAL_SERVER_ERROR";
  /**
   * AppError: luôn trả message.
   * Lỗi kỹ thuật 5xx (Prisma, Nodemailer, BullMQ…): production chỉ báo chung; development trả message gốc để debug.
   */
  const message =
    error instanceof AppError
      ? error.message || "Request failed"
      : statusCode >= 500
        ? config.app.isProduction
          ? "An unexpected error occurred"
          : (error.message || "An unexpected error occurred")
        : error.message || "Request failed";

  logger.error(
    {
      err: error,
      requestId: req.requestId,
      path: req.originalUrl,
      method: req.method,
      statusCode,
      code,
    },
    "Request failed",
  );

  const errorBody = {
    code,
    ...(error.details ? { details: error.details } : {}),
  };

  if (shouldExposeErrorDebug()) {
    errorBody.debug = {
      name: error?.name || "Error",
      detail: error?.message || null,
      ...(typeof error?.stack === "string"
        ? { stackPreview: error.stack.split("\n").slice(0, 8).join("\n") }
        : {}),
    };
  }

  if (
    statusCode === 429 &&
    error instanceof AppError &&
    error.details?.retryAfterSec != null &&
    Number.isFinite(Number(error.details.retryAfterSec))
  ) {
    const sec = Math.max(1, Math.ceil(Number(error.details.retryAfterSec)));
    res.setHeader("Retry-After", String(sec));
  }

  return res.status(statusCode).json({
    success: false,
    message,
    error: errorBody,
  });
}

export { errorMiddleware };
