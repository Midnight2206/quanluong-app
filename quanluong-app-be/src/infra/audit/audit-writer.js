import { getAuditLogQueue } from "../queue/audit-log.queue.js";
import { logger } from "../../shared/utils/logger.js";

const FLUSH_MS = 1000;
const MAX_BUFFER = 200;
const KINDS = ["auth", "changes", "usage", "heartbeats"];

let buffer = emptyBatch();
let timer = null;
let persistImpl = null;
let queueGetter = getAuditLogQueue;

function emptyBatch() {
  return { auth: [], changes: [], usage: [], heartbeats: [] };
}

function size(b) {
  return KINDS.reduce((n, k) => n + b[k].length, 0);
}

async function loadPersist() {
  if (!persistImpl) {
    ({ persistAuditBatch: persistImpl } = await import("./audit-persist.js"));
  }
  return persistImpl;
}

async function flushAudit() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const batch = buffer;
  buffer = emptyBatch();
  if (!size(batch)) return;
  try {
    const queue = queueGetter();
    if (queue) {
      await queue.add("batch", batch, { removeOnComplete: true, removeOnFail: 500, attempts: 3, backoff: { type: "exponential", delay: 2000 } });
      return;
    }
  } catch (error) {
    logger.warn({ err: error }, "audit queue unavailable — writing directly");
  }
  try {
    const persist = await loadPersist();
    await persist(batch);
  } catch (error) {
    logger.error({ err: error, count: size(batch) }, "audit log write failed");
  }
}

/** Không bao giờ ném lỗi ra ngoài; không chặn request. */
function enqueueAudit(kind, items) {
  try {
    if (process.env.AUDIT_ENABLED === "false") return;
    const list = Array.isArray(items) ? items : [items];
    if (!list.length) return;
    buffer[kind].push(...list);
    if (size(buffer) >= MAX_BUFFER) {
      void flushAudit();
    } else if (!timer) {
      timer = setTimeout(() => void flushAudit(), FLUSH_MS);
      timer.unref?.();
    }
  } catch (error) {
    logger.error({ err: error }, "audit enqueue failed");
  }
}

/** Chỉ dùng trong test. */
function __setAuditWriterForTest({ persist, queue } = {}) {
  persistImpl = persist ?? null;
  queueGetter = queue ? () => queue : getAuditLogQueue;
  buffer = emptyBatch();
}

function __peekAuditBuffer() {
  return buffer;
}

export { __peekAuditBuffer, __setAuditWriterForTest, enqueueAudit, flushAudit };
