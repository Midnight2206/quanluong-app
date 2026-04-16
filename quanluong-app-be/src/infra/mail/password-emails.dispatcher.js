import { getEmailVerificationQueue } from "../queue/email-verification.queue.js";
import { logger } from "../../shared/utils/logger.js";
import { sendPasswordChangedNotification } from "./send-password-changed-notification.js";
import { sendPasswordResetEmail } from "./send-password-reset-email.js";

const jobOpts = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 4000,
  },
  removeOnComplete: true,
};

/**
 * Gửi email đặt lại mật khẩu (queue nếu có Redis, không thì đồng bộ). Không ném lỗi — caller log nếu cần.
 */
async function tryDispatchPasswordResetEmail({ to, token, username }) {
  const queue = getEmailVerificationQueue();
  if (queue) {
    await queue.add("send-password-reset", { to, token, username }, jobOpts);
    logger.info({ to }, "Đã xếp job gửi email đặt lại mật khẩu");
    return { viaQueue: true };
  }
  const ok = await sendPasswordResetEmail({ to, token, username });
  return { viaQueue: false, ok };
}

/**
 * Thông báo đã đổi mật khẩu — không chặn luồng chính nếu gửi thất bại.
 */
async function tryDispatchPasswordChangedEmail({ to, username }) {
  const queue = getEmailVerificationQueue();
  if (queue) {
    await queue.add("send-password-changed", { to, username }, jobOpts);
    logger.info({ to }, "Đã xếp job gửi thông báo đổi mật khẩu");
    return { viaQueue: true };
  }
  const ok = await sendPasswordChangedNotification({ to, username });
  return { viaQueue: false, ok };
}

export { tryDispatchPasswordChangedEmail, tryDispatchPasswordResetEmail };
