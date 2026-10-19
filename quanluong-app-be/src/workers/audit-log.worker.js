import { Worker } from "bullmq";
import Redis from "ioredis";
import { config } from "../config/config.js";
import { AUDIT_LOG_QUEUE_NAME } from "../infra/queue/audit-log.queue.js";
import { persistAuditBatch } from "../infra/audit/audit-persist.js";
import { logger } from "../shared/utils/logger.js";

if (!config.redis.url) {
  logger.error("REDIS_URL bắt buộc để chạy worker nhật ký.");
  process.exit(1);
}

const connection = new Redis(config.redis.url, { maxRetriesPerRequest: null });

const worker = new Worker(
  AUDIT_LOG_QUEUE_NAME,
  async (job) => {
    await persistAuditBatch(job.data);
  },
  { connection, concurrency: 2 },
);

worker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "audit-log job failed");
});

logger.info("audit-log worker started");

async function shutdown() {
  await worker.close();
  await connection.quit();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
