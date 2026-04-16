import { createQueue } from "./bullmq.client.js";

const AVATAR_PROCESSING_QUEUE_NAME = "avatar-processing";

let cachedQueue;

function getAvatarProcessingQueue() {
  if (cachedQueue !== undefined) {
    return cachedQueue;
  }
  const q = createQueue(AVATAR_PROCESSING_QUEUE_NAME);
  cachedQueue = q;
  return cachedQueue;
}

export { AVATAR_PROCESSING_QUEUE_NAME, getAvatarProcessingQueue };
