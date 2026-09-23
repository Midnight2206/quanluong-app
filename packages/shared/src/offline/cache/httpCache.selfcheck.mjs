/**
 * node packages/shared/src/offline/cache/httpCache.selfcheck.mjs
 */
import assert from "node:assert/strict";
import { buildCacheKey } from "./httpCache.js";
import { isCacheStale, ttlMsForResourceKind, TTL_MS } from "./ttlPolicy.js";

const k1 = buildCacheKey("/lttp/commodities", { unitId: 3, z: 1, a: 2 });
const k2 = buildCacheKey("/lttp/commodities", { a: 2, unitId: 3, z: 1 });
assert.equal(k1, k2);
assert.equal(k1, "GET /lttp/commodities?a=2&unitId=3&z=1");

assert.equal(buildCacheKey("/auth/current-user", null), "GET /auth/current-user");

assert.equal(ttlMsForResourceKind("profile"), TTL_MS.profile);
assert.equal(ttlMsForResourceKind("lttp.commodities"), TTL_MS.lttpCommodities);
assert.equal(ttlMsForResourceKind("other"), TTL_MS.default);

const syncedAt = new Date("2026-01-01T00:00:00.000Z").toISOString();
const now = Date.parse("2026-01-01T00:06:00.000Z");
assert.equal(isCacheStale(syncedAt, TTL_MS.profile, now), true);
assert.equal(isCacheStale(syncedAt, TTL_MS.profile, now - 60_000), false);

console.log("offline httpCache: ok");
