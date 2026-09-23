/**
 * Pure patches + refetch helpers for conflict UI (Task 8).
 */

/**
 * @param {Record<string, unknown>|null|undefined} serverEntity
 */
export function extractServerVersion(serverEntity) {
  return (
    serverEntity?.version ??
    serverEntity?.baseVersion ??
    serverEntity?.updatedAt ??
    null
  );
}

/**
 * @param {import("./operations.js").OutboxItem} item
 * @param {(opts: Record<string, unknown>) => Promise<unknown>} apiRequest
 */
export async function fetchServerEntityForItem(item, apiRequest) {
  const url = item.payload?.refetchUrl ?? item.payload?.url;
  if (!url || typeof url !== "string") {
    return null;
  }
  try {
    const data = await apiRequest({ url, method: "get" });
    return data && typeof data === "object"
      ? /** @type {Record<string, unknown>} */ (data)
      : null;
  } catch {
    return null;
  }
}

/**
 * @param {import("./operations.js").OutboxItem} item
 * @param {string} nowIso
 */
export function patchKeepServer(item, nowIso) {
  return {
    ...item,
    status: /** @type {const} */ ("synced"),
    lastError: null,
    updatedAt: nowIso,
  };
}

/**
 * @param {import("./operations.js").OutboxItem} item
 * @param {Record<string, unknown>|null|undefined} serverEntity
 * @param {string} nowIso
 */
export function patchReapply(item, serverEntity, nowIso) {
  return {
    ...item,
    baseVersion: extractServerVersion(serverEntity),
    status: /** @type {const} */ ("pending"),
    lastError: null,
    updatedAt: nowIso,
  };
}

/** @param {unknown} value */
function previewJson(value) {
  if (value == null) {
    return "—";
  }
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > 1200 ? `${s.slice(0, 1200)}…` : s;
  } catch {
    return String(value);
  }
}

/**
 * @param {import("./operations.js").OutboxItem} item
 * @param {Record<string, unknown>|null|undefined} serverEntity
 */
export function summarizeConflict(item, serverEntity) {
  const localBody = item.payload?.body ?? item.payload;
  const serverBody =
    serverEntity?.data ??
    serverEntity?.body ??
    (serverEntity && typeof serverEntity === "object"
      ? Object.fromEntries(
          Object.entries(serverEntity).filter(([k]) => !["version", "baseVersion", "updatedAt"].includes(k)),
        )
      : null);
  return {
    operation: item.operation,
    entityId: item.entityId ?? "—",
    localBaseVersion: item.baseVersion ?? "—",
    serverVersion: extractServerVersion(serverEntity) ?? "—",
    localPreview: previewJson(localBody),
    serverPreview: previewJson(serverBody),
  };
}
