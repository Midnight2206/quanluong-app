/**
 * @param {string|number|null|undefined} localBase
 * @param {string|number|null|undefined} serverVersion
 * @returns {'match'|'mismatch'}
 */
export function compareBaseVersion(localBase, serverVersion) {
  if (localBase == null && serverVersion == null) {
    return "match";
  }
  if (localBase == null || serverVersion == null) {
    return "mismatch";
  }
  return String(localBase) === String(serverVersion) ? "match" : "mismatch";
}

/**
 * @param {import("./operations.js").OutboxItem} item
 * @param {Record<string, unknown>|null|undefined} serverEntity
 * @param {{
 *   apiRequest: (opts: Record<string, unknown>) => Promise<unknown>;
 *   applyUpdate?: (item: import("./operations.js").OutboxItem, serverEntity: Record<string, unknown>) => Promise<void>;
 * }} deps
 * @returns {Promise<'synced'|'needs_review'>}
 */
export async function resolveUpdateConflict(item, serverEntity, { apiRequest, applyUpdate }) {
  const serverVersion =
    serverEntity?.version ??
    serverEntity?.baseVersion ??
    serverEntity?.updatedAt ??
    null;
  if (compareBaseVersion(item.baseVersion, serverVersion) === "mismatch") {
    return "needs_review";
  }
  if (typeof applyUpdate === "function") {
    await applyUpdate(item, serverEntity ?? {});
  } else {
    const { url, method = "put", body } = item.payload ?? {};
    if (!url) {
      throw new Error("outbox: update payload missing url");
    }
    await apiRequest({ url, method, data: body });
  }
  return "synced";
}
