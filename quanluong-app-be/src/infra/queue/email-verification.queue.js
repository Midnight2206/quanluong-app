import { createQueue } from "./bullmq.client.js";

const EMAIL_VERIFICATION_QUEUE_NAME = "email-verification";

let cachedQueue;

function getEmailVerificationQueue() {
  if (cachedQueue) {
    return cachedQueue;
  }
  const q = createQueue(EMAIL_VERIFICATION_QUEUE_NAME);
  if (q) {
    cachedQueue = q;
  }
  return cachedQueue;
}

export { EMAIL_VERIFICATION_QUEUE_NAME, getEmailVerificationQueue };
