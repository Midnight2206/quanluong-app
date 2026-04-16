import { Worker } from "bullmq";
import Redis from "ioredis";
import { config } from "../config/config.js";
import { EMAIL_VERIFICATION_QUEUE_NAME } from "../infra/queue/email-verification.queue.js";
import { sendPasswordChangedNotification } from "../infra/mail/send-password-changed-notification.js";
import { sendPasswordResetEmail } from "../infra/mail/send-password-reset-email.js";
import { sendVerificationEmail } from "../infra/mail/send-verification-email.js";
import { logger } from "../shared/utils/logger.js";

if (!config.redis.url) {
  logger.error("REDIS_URL bắt buộc để chạy worker email xác minh.");
  process.exit(1);
}

const connection = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  EMAIL_VERIFICATION_QUEUE_NAME,
  async (job) => {
    const name = job.name || "send-verification";

    if (name === "send-password-reset") {
      const { to, token, username } = job.data;
      if (!to || !token) {
        throw new Error("Job password-reset thiếu to hoặc token");
      }
      const ok = await sendPasswordResetEmail({ to, token, username });
      if (!ok) {
        throw new Error("sendPasswordResetEmail trả về false");
      }
      return;
    }

    if (name === "send-password-changed") {
      const { to, username } = job.data;
      if (!to) {
        throw new Error("Job password-changed thiếu to");
      }
      const ok = await sendPasswordChangedNotification({ to, username });
      if (!ok) {
        throw new Error("sendPasswordChangedNotification trả về false");
      }
      return;
    }

    const { to, token, username } = job.data;
    if (!to || !token) {
      throw new Error("Job thiếu to hoặc token");
    }
    const ok = await sendVerificationEmail({ to, token, username });
    if (!ok) {
      throw new Error("sendVerificationEmail trả về false (kiểm tra SMTP hoặc Gmail API)");
    }
  },
  { connection },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Job email xác minh hoàn tất");
});

worker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "Job email xác minh thất bại");
});

function shutdown(signal) {
  logger.info({ signal }, "Đang dừng worker email xác minh…");
  void worker
    .close()
    .then(() => connection.quit())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, "Lỗi khi dừng worker");
      process.exit(1);
    });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

logger.info({ queue: EMAIL_VERIFICATION_QUEUE_NAME }, "Worker email xác minh đã chạy");
