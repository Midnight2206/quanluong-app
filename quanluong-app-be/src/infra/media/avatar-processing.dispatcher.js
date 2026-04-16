import { getAvatarProcessingQueue } from "../queue/avatar-processing.queue.js";
import { finalizeAvatarFromStaging } from "../../modules/auth/avatar-processing.service.js";
import { logger } from "../../shared/utils/logger.js";

/**
 * Đưa xử lý ảnh (sharp, ghi avatars, cập nhật DB) sang BullMQ.
 * Không có Redis/queue → trả viaQueue: false để API gọi finalize đồng bộ.
 */
async function dispatchAvatarProcessing({ userId, stagingRelativePath, crop }) {
  const queue = getAvatarProcessingQueue();
  if (!queue) {
    return { viaQueue: false };
  }

  const job = await queue.add(
    "process-avatar",
    { userId, stagingRelativePath, crop: crop ?? null },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 1500 },
      removeOnComplete: { count: 300 },
      removeOnFail: { count: 100 },
    },
  );

  logger.info({ jobId: job.id, userId }, "Đã xếp job xử lý avatar");
  return { viaQueue: true, jobId: String(job.id) };
}

async function getAvatarJobStatusForUser(jobId, userId) {
  const queue = getAvatarProcessingQueue();
  if (!queue) {
    return { unavailable: true };
  }

  const job = await queue.getJob(jobId);
  if (!job) {
    return { notFound: true };
  }
  if (job.data?.userId !== userId) {
    return { forbidden: true };
  }

  const state = await job.getState();

  if (state === "completed") {
    const result = job.returnvalue;
    return {
      status: "completed",
      publicUrl: result?.publicUrl ?? null,
    };
  }

  if (state === "failed") {
    return {
      status: "failed",
      error: job.failedReason || "Xử lý ảnh thất bại.",
    };
  }

  return { status: state === "delayed" ? "waiting" : state };
}

async function runAvatarProcessingSync({ userId, stagingRelativePath, crop }) {
  return finalizeAvatarFromStaging({ userId, stagingRelativePath, crop });
}

export { dispatchAvatarProcessing, getAvatarJobStatusForUser, runAvatarProcessingSync };
