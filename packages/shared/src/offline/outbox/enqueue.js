import { assertCanEnqueueBlob } from "./blobQuota.js";
import { DEFAULT_MAX_RETRIES } from "./operations.js";

function newUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {import("dexie").Dexie} db
 * @param {Partial<import("./operations.js").OutboxItem> & Pick<import("./operations.js").OutboxItem, "userId"|"operation"|"payload">} itemPartial
 * @returns {Promise<string>}
 */
export async function enqueueOutboxItem(db, itemPartial) {
  const now = new Date().toISOString();
  const id = itemPartial.id ?? newUuid();
  const idempotencyKey = itemPartial.idempotencyKey ?? newUuid();
  await assertCanEnqueueBlob(db, itemPartial.fileBlob);

  /** @type {import("./operations.js").OutboxItem} */
  const record = {
    id,
    userId: Number(itemPartial.userId),
    idempotencyKey,
    entityId: itemPartial.entityId ?? undefined,
    operation: itemPartial.operation,
    payload: itemPartial.payload ?? {},
    fileBlob: itemPartial.fileBlob ?? null,
    baseVersion: itemPartial.baseVersion ?? null,
    status: itemPartial.status ?? "pending",
    retryCount: itemPartial.retryCount ?? 0,
    maxRetries: itemPartial.maxRetries ?? DEFAULT_MAX_RETRIES,
    lastError: itemPartial.lastError ?? null,
    createdAt: itemPartial.createdAt ?? now,
    updatedAt: now,
  };
  await db.table("outbox").put(record);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("offline-outbox-changed"));
  }
  return id;
}
