import { createQueue } from "./bullmq.client.js";

const AUDIT_LOG_QUEUE_NAME = "audit-log";

let cachedQueue;

function getAuditLogQueue() {
  if (cachedQueue !== undefined) {
    return cachedQueue;
  }
  cachedQueue = createQueue(AUDIT_LOG_QUEUE_NAME);
  return cachedQueue;
}

export { AUDIT_LOG_QUEUE_NAME, getAuditLogQueue };
