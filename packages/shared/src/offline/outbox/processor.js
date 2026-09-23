import { resolveUpdateConflict } from "./conflict.js";
import { isAuthExpired, isForbidden, isClientError } from "./errors.js";
import {
  isAutoRetryOperation,
  isVersionedUpdateOperation,
  OP_IMPORT_EXCEL,
  OP_UPLOAD_IMAGE,
} from "./operations.js";

/** @param {number} retryCount */
export function backoffMs(retryCount) {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, retryCount));
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {import("dexie").Dexie} db
 * @param {string|number} userId
 */
async function resetStaleSyncing(db, userId) {
  const stuck = await db
    .table("outbox")
    .where("userId")
    .equals(Number(userId))
    .filter((r) => r.status === "syncing")
    .toArray();
  for (const r of stuck) {
    await db.table("outbox").put({ ...r, status: "pending", updatedAt: nowIso() });
  }
}

/**
 * @param {import("dexie").Dexie} db
 * @param {string|number} userId
 */
async function listFifoPending(db, userId) {
  const rows = await db
    .table("outbox")
    .where("userId")
    .equals(Number(userId))
    .filter((r) => r.status === "pending")
    .toArray();
  return rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/**
 * @param {import("./operations.js").OutboxItem} item
 * @param {(opts: Record<string, unknown>) => Promise<unknown>} apiRequest
 */
async function processCreateLike(item, apiRequest) {
  const { url, method = "post", body } = item.payload ?? {};
  if (!url) {
    throw new Error("outbox: create payload missing url");
  }
  await apiRequest({
    url,
    method,
    data: body,
    headers: { "Idempotency-Key": item.idempotencyKey },
  });
}

/**
 * @param {import("./operations.js").OutboxItem} item
 */
function buildUploadFormData(item) {
  const payload = item.payload ?? {};
  const { url, fileField = "file", fileName, formFields = {} } = payload;
  if (!url) {
    throw new Error(`outbox: ${item.operation} payload missing url`);
  }
  if (item.fileBlob == null) {
    throw new Error(`outbox: ${item.operation} missing fileBlob`);
  }
  const fd = new FormData();
  const name = fileName ?? "upload";
  fd.append(fileField, item.fileBlob, name);
  for (const [key, value] of Object.entries(formFields)) {
    fd.append(key, value == null ? "" : String(value));
  }
  return { url, method: payload.method ?? "post", fd };
}

/**
 * @param {import("./operations.js").OutboxItem} item
 * @param {(opts: Record<string, unknown>) => Promise<unknown>} apiRequest
 */
async function processUploadImage(item, apiRequest) {
  const { url, method, fd } = buildUploadFormData(item);
  const data = await apiRequest({
    url,
    method,
    data: fd,
    headers: { "Idempotency-Key": item.idempotencyKey },
  });
  const rec = data && typeof data === "object" ? data : {};
  const serverFileUrl =
    rec.url ?? rec.imageUrl ?? rec.fileUrl ?? rec.avatarUrl ?? (typeof data === "string" ? data : null);
  return { serverFileUrl, response: data };
}

/**
 * @param {import("./operations.js").OutboxItem} item
 * @param {(opts: Record<string, unknown>) => Promise<unknown>} apiRequest
 */
async function processImportExcel(item, apiRequest) {
  const { url, method, fd } = buildUploadFormData(item);
  const data = await apiRequest({
    url,
    method,
    data: fd,
    headers: { "Idempotency-Key": item.idempotencyKey },
  });
  const rec = data && typeof data === "object" ? data : {};
  if (rec.ok === false || rec.success === false) {
    const message = rec.message ?? rec.error ?? "Import thất bại";
    throw { status: 422, data: { message }, message };
  }
  return data;
}

/**
 * @param {import("dexie").Dexie} db
 * @param {import("./operations.js").OutboxItem} item
 * @param {Record<string, unknown>} patch
 */
async function markBlobOpSynced(db, item, patch) {
  await db.table("outbox").put({
    ...item,
    ...patch,
    status: "synced",
    fileBlob: null,
    lastError: null,
    updatedAt: nowIso(),
  });
}

/**
 * @param {import("dexie").Dexie} db
 * @param {{
 *   userId: string|number;
 *   apiRequest: (opts: Record<string, unknown>) => Promise<unknown>;
 *   handlers?: {
 *     refetchEntity?: (item: import("./operations.js").OutboxItem) => Promise<Record<string, unknown>|null>;
 *     applyUpdate?: (item: import("./operations.js").OutboxItem, serverEntity: Record<string, unknown>) => Promise<void>;
 *   };
 *   sleep?: (ms: number) => Promise<void>;
 * }} opts
 */
export async function flushOutbox(db, { userId, apiRequest, handlers = {}, sleep = defaultSleep } = {}) {
  if (userId == null || db == null) {
    return { flushed: 0, failed: 0, needsReview: 0, authExpired: false, forbidden: 0 };
  }

  await resetStaleSyncing(db, userId);
  const queue = await listFifoPending(db, userId);

  let flushed = 0;
  let failed = 0;
  let needsReview = 0;
  let authExpired = false;
  let forbidden = 0;

  for (const item of queue) {
    if ((item.retryCount ?? 0) > 0) {
      await sleep(backoffMs(item.retryCount ?? 0));
    }

    const syncing = { ...item, status: "syncing", updatedAt: nowIso() };
    await db.table("outbox").put(syncing);

    try {
      if (item.operation === OP_UPLOAD_IMAGE) {
        const { serverFileUrl, response } = await processUploadImage(item, apiRequest);
        await markBlobOpSynced(db, item, {
          payload: {
            ...item.payload,
            serverFileUrl: serverFileUrl ?? item.payload?.serverFileUrl ?? null,
            uploadResponse: response,
          },
        });
        flushed += 1;
      } else if (item.operation === OP_IMPORT_EXCEL) {
        const importResult = await processImportExcel(item, apiRequest);
        await markBlobOpSynced(db, item, {
          payload: { ...item.payload, importResult },
        });
        flushed += 1;
      } else if (isAutoRetryOperation(item.operation)) {
        await processCreateLike(item, apiRequest);
        await db.table("outbox").put({
          ...item,
          status: "synced",
          lastError: null,
          updatedAt: nowIso(),
        });
        flushed += 1;
      } else if (isVersionedUpdateOperation(item.operation)) {
        const refetch = handlers.refetchEntity;
        if (typeof refetch !== "function") {
          throw new Error(`outbox: refetchEntity required for ${item.operation}`);
        }
        const serverEntity = await refetch(item);
        const outcome = await resolveUpdateConflict(item, serverEntity, {
          apiRequest,
          applyUpdate: handlers.applyUpdate,
        });
        if (outcome === "needs_review") {
          await db.table("outbox").put({
            ...item,
            status: "needs_review",
            updatedAt: nowIso(),
          });
          needsReview += 1;
        } else {
          await db.table("outbox").put({
            ...item,
            status: "synced",
            lastError: null,
            updatedAt: nowIso(),
          });
          flushed += 1;
        }
      } else {
        throw new Error(`outbox: unknown operation ${String(item.operation)}`);
      }
    } catch (err) {
      if (isAuthExpired(err)) {
        await db.table("outbox").put({
          ...item,
          status: "pending",
          lastError: String(err?.data?.message ?? err?.message ?? "AUTH_EXPIRED"),
          updatedAt: nowIso(),
        });
        authExpired = true;
        break;
      }
      if (isForbidden(err)) {
        await db.table("outbox").put({
          ...item,
          status: "failed",
          lastError: String(
            err?.data?.message ?? err?.message ?? "Bạn không có quyền thực hiện thao tác này",
          ),
          updatedAt: nowIso(),
        });
        failed += 1;
        forbidden += 1;
        continue;
      }
      if (isAutoRetryOperation(item.operation)) {
        if (isClientError(err)) {
          await db.table("outbox").put({
            ...item,
            status: "failed",
            lastError: String(err?.data?.message ?? err?.data ?? err?.message ?? err?.status),
            updatedAt: nowIso(),
          });
          failed += 1;
        } else {
          const retryCount = (item.retryCount ?? 0) + 1;
          const terminal = retryCount >= (item.maxRetries ?? 5);
          await db.table("outbox").put({
            ...item,
            status: terminal ? "failed" : "pending",
            retryCount,
            lastError: String(err?.data?.message ?? err?.message ?? "network"),
            updatedAt: nowIso(),
          });
          if (terminal) {
            failed += 1;
          }
        }
      } else {
        await db.table("outbox").put({
          ...item,
          status: "failed",
          lastError: String(err?.message ?? err),
          updatedAt: nowIso(),
        });
        failed += 1;
      }
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("offline-outbox-changed"));
  }
  return { flushed, failed, needsReview, authExpired, forbidden };
}

/** @param {number} ms */
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
