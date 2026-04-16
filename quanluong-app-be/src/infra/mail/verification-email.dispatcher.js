import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { getEmailVerificationQueue } from "../queue/email-verification.queue.js";
import { logger } from "../../shared/utils/logger.js";
import { sendVerificationEmail } from "./send-verification-email.js";

/**
 * Ưu tiên đưa job vào BullMQ (worker gửi mail). Nếu không có Redis/queue thì gửi đồng bộ (SMTP hoặc Gmail API).
 */
async function dispatchVerificationEmail({ to, token, username }) {
  const queue = getEmailVerificationQueue();
  if (queue) {
    await queue.add(
      "send-verification",
      { to, token, username },
      {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 4000,
        },
        removeOnComplete: true,
      },
    );
    logger.info({ to }, "Đã xếp job gửi email xác minh");
    return { viaQueue: true };
  }

  const ok = await sendVerificationEmail({ to, token, username });
  if (!ok) {
    throw new AppError({
      message: "Không gửi được email (chưa cấu hình SMTP/Gmail API hoặc lỗi kết nối).",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  logger.info({ to }, "Đã gửi email xác minh trực tiếp (không có queue)");
  return { viaQueue: false };
}

export { dispatchVerificationEmail };
