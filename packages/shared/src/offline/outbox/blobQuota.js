/** Per-file and total queued blob limits (offline outbox). */

/** @type {number} 8 MiB per file */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** @type {number} 32 MiB total blob bytes across outbox rows that still hold fileBlob */
export const MAX_QUEUE_BLOB_BYTES = 32 * 1024 * 1024;

/**
 * @param {import("dexie").Dexie} db
 * @param {number} [additionalBytes=0]
 * @returns {Promise<{ ok: boolean; totalBytes: number; projected: number; warn: boolean }>}
 */
export async function checkBlobQuota(db, additionalBytes = 0) {
  const rows = await db.table("outbox").toArray();
  let totalBytes = 0;
  for (const row of rows) {
    const blob = row?.fileBlob;
    if (blob != null && typeof blob.size === "number") {
      totalBytes += blob.size;
    }
  }
  const add = Number(additionalBytes) || 0;
  const projected = totalBytes + add;
  const ok = projected <= MAX_QUEUE_BLOB_BYTES;
  const warn = !ok || projected > MAX_QUEUE_BLOB_BYTES * 0.875;
  return { ok, totalBytes, projected, warn };
}

/**
 * @param {import("dexie").Dexie} db
 * @param {Blob|null|undefined} fileBlob
 */
export async function assertCanEnqueueBlob(db, fileBlob) {
  if (fileBlob == null) {
    return;
  }
  if (fileBlob.size > MAX_FILE_BYTES) {
    throw new Error(`outbox: file exceeds ${MAX_FILE_BYTES} bytes`);
  }
  const { ok } = await checkBlobQuota(db, fileBlob.size);
  if (!ok) {
    throw new Error("outbox: queue blob quota exceeded");
  }
}
