import { ttlMsForResourceKind } from "./ttlPolicy.js";

/**
 * Canonical GET cache key — param keys sorted for stability.
 * @param {string} url
 * @param {Record<string, unknown> | null | undefined} params
 */
export function buildCacheKey(url, params) {
  const path = String(url);
  if (params == null || typeof params !== "object") {
    return `GET ${path}`;
  }
  const keys = Object.keys(params).sort();
  if (keys.length === 0) {
    return `GET ${path}`;
  }
  const qs = keys
    .map((k) => {
      const v = params[k];
      return `${encodeURIComponent(k)}=${encodeURIComponent(v == null ? "" : String(v))}`;
    })
    .join("&");
  return `GET ${path}?${qs}`;
}

/**
 * @param {import("dexie").Dexie | null | undefined} db
 * @param {string} key
 */
export async function getCached(db, key) {
  if (db == null) {
    return null;
  }
  const row = await db.table("httpCache").get(key);
  return row ?? null;
}

/**
 * @param {import("dexie").Dexie | null | undefined} db
 * @param {{
 *   cacheKey: string;
 *   url: string;
 *   params?: Record<string, unknown> | null;
 *   data: unknown;
 *   resourceKind?: string;
 *   ttlMs?: number;
 * }} entry
 */
export async function setCached(db, entry) {
  if (db == null) {
    return;
  }
  const { cacheKey, url, params, data, resourceKind, ttlMs } = entry;
  const resolvedTtl = ttlMs ?? ttlMsForResourceKind(resourceKind);
  await db.table("httpCache").put({
    cacheKey,
    url,
    paramsJson: params != null ? JSON.stringify(params) : undefined,
    resourceKind,
    data,
    lastSyncedAt: new Date().toISOString(),
    ttlMs: resolvedTtl,
  });
}
