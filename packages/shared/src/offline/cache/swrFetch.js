import { buildCacheKey, getCached, setCached } from "./httpCache.js";
import { isCacheStale, ttlMsForResourceKind } from "./ttlPolicy.js";

/**
 * Stale-while-revalidate GET: network refresh; on failure keep cache if present.
 * @param {{
 *   db: import("dexie").Dexie | null | undefined;
 *   url: string;
 *   params?: Record<string, unknown> | null;
 *   resourceKind?: string;
 *   fetcher: () => Promise<unknown>;
 * }} opts
 * @returns {Promise<{ data: unknown; fromCache: boolean; stale: boolean; error?: unknown }>}
 */
export async function swrFetch({ db, url, params, resourceKind, fetcher }) {
  const cacheKey = buildCacheKey(url, params);
  const ttlMs = ttlMsForResourceKind(resourceKind);
  const entry = await getCached(db, cacheKey);
  const entryTtl = entry?.ttlMs ?? ttlMs;
  const staleBeforeFetch = entry
    ? isCacheStale(entry.lastSyncedAt, entryTtl)
    : false;

  try {
    const data = await fetcher();
    await setCached(db, { cacheKey, url, params, data, resourceKind, ttlMs });
    return { data, fromCache: false, stale: false };
  } catch (error) {
    if (entry) {
      return {
        data: entry.data,
        fromCache: true,
        stale: staleBeforeFetch || true,
        error,
      };
    }
    throw error;
  }
}
