/** @typedef {'profile' | 'lttp.commodities' | string} ResourceKind */

export const RESOURCE_KIND = {
  profile: "profile",
  lttpCommodities: "lttp.commodities",
};

export const TTL_MS = {
  profile: 5 * 60 * 1000,
  lttpCommodities: 24 * 60 * 60 * 1000,
  default: 10 * 60 * 1000,
};

/** @param {ResourceKind | undefined} resourceKind */
export function ttlMsForResourceKind(resourceKind) {
  if (resourceKind === RESOURCE_KIND.profile) {
    return TTL_MS.profile;
  }
  if (resourceKind === RESOURCE_KIND.lttpCommodities) {
    return TTL_MS.lttpCommodities;
  }
  return TTL_MS.default;
}

/**
 * @param {string | number | Date | undefined} lastSyncedAt ISO or ms
 * @param {number} ttlMs
 * @param {number} [nowMs]
 */
export function isCacheStale(lastSyncedAt, ttlMs, nowMs = Date.now()) {
  if (lastSyncedAt == null || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    return true;
  }
  const syncedMs =
    typeof lastSyncedAt === "number"
      ? lastSyncedAt
      : Date.parse(String(lastSyncedAt));
  if (!Number.isFinite(syncedMs)) {
    return true;
  }
  return nowMs - syncedMs > ttlMs;
}
