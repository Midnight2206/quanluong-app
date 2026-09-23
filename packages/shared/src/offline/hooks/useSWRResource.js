"use client";

import { useEffect, useState } from "react";
import { buildCacheKey, getCached } from "../cache/httpCache.js";
import { swrFetch } from "../cache/swrFetch.js";
import { isCacheStale, ttlMsForResourceKind } from "../cache/ttlPolicy.js";
import { useOffline } from "../OfflineProvider.jsx";

/**
 * Dexie SWR read — requires OfflineProvider ancestor.
 * @param {{
 *   url: string;
 *   params?: Record<string, unknown> | null;
 *   resourceKind?: string;
 *   fetcher: () => Promise<unknown>;
 *   enabled?: boolean;
 * }} opts
 */
export function useSWRResource({
  url,
  params,
  resourceKind,
  fetcher,
  enabled = true,
}) {
  const { db, ready } = useOffline();
  const cacheKey = buildCacheKey(url, params);
  const [state, setState] = useState({
    data: undefined,
    loading: Boolean(enabled),
    error: null,
    fromCache: false,
    stale: false,
  });

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return undefined;
    }
    if (!ready) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));

      if (db) {
        const entry = await getCached(db, cacheKey);
        if (entry && !cancelled) {
          const ttlMs = entry.ttlMs ?? ttlMsForResourceKind(resourceKind);
          setState({
            data: entry.data,
            loading: true,
            error: null,
            fromCache: true,
            stale: isCacheStale(entry.lastSyncedAt, ttlMs),
          });
        }
      }

      try {
        const result = await swrFetch({ db, url, params, resourceKind, fetcher });
        if (cancelled) {
          return;
        }
        setState({
          data: result.data,
          loading: false,
          error: result.error ?? null,
          fromCache: result.fromCache,
          stale: result.stale,
        });
      } catch (error) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // ponytail: fetcher/params identity not in deps — cacheKey captures params snapshot
  }, [enabled, ready, db, cacheKey, url, resourceKind]);

  return state;
}
