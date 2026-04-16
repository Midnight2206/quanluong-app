import { Queue } from "bullmq";
import { redis } from "../cache/redis.client.js";

function createQueue(name) {
  if (!redis) {
    return null;
  }

  /** Queue dùng connection bản sao — tránh block/chia sẻ connection với lệnh Redis thường (khuyến nghị BullMQ). */
  return new Queue(name, {
    connection: redis.duplicate(),
  });
}

export { createQueue };
