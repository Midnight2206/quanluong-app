import { Worker } from "bullmq";
import Redis from "ioredis";
import { config } from "../config/config.js";
import { AVATAR_PROCESSING_QUEUE_NAME } from "../infra/queue/avatar-processing.queue.js";
import {
  finalizeAvatarFromStaging,
  unlinkStagingSafe,
} from "../modules/auth/avatar-processing.service.js";
import { logger } from "../shared/utils/logger.js";
import { prisma } from "../infra/database/prisma/prisma.client.js";

if (!config.redis.url) {
  logger.error("REDIS_URL bắt buộc để chạy worker xử lý avatar.");
  process.exit(1);
}

const connection = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  AVATAR_PROCESSING_QUEUE_NAME,
  async (job) => {
    const { userId, stagingRelativePath, crop } = job.data;
    try {
      return await finalizeAvatarFromStaging({ userId, stagingRelativePath, crop });
    } catch (err) {
      await unlinkStagingSafe(stagingRelativePath);
      throw err;
    }
  },
  { connection },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Job xử lý avatar hoàn tất");
});

worker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "Job xử lý avatar thất bại");
});

function shutdown(signal) {
  logger.info({ signal }, "Đang dừng worker xử lý avatar…");
  void worker
    .close()
    .then(() => prisma.$disconnect())
    .then(() => connection.quit())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, "Lỗi khi dừng worker avatar");
      process.exit(1);
    });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

logger.info({ queue: AVATAR_PROCESSING_QUEUE_NAME }, "Worker xử lý avatar đã chạy");
