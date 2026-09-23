import assert from "node:assert/strict";
import { runReconnectSync } from "./runReconnectSync.js";

const log = [];
await runReconnectSync({
  flushOutbox: async () => {
    log.push("flush");
    return { flushed: 0, failed: 0, needsReview: 0 };
  },
  invalidate: () => log.push("invalidate"),
  refetchActive: async () => {
    log.push("refetch");
  },
  prefetchBoot: async () => {
    log.push("prefetch");
  },
});
assert.deepEqual(log, ["flush", "invalidate", "refetch", "prefetch"]);

let failed = false;
try {
  await runReconnectSync({
    flushOutbox: async () => {
      throw new Error("boom");
    },
    invalidate: () => {},
    refetchActive: async () => {},
    prefetchBoot: async () => {},
  });
} catch {
  failed = true;
}
assert.equal(failed, true);

let partialFlushBlocked = false;
try {
  await runReconnectSync({
    flushOutbox: async () => ({ flushed: 1, failed: 1, needsReview: 0 }),
    invalidate: () => log.push("invalidate-after-fail"),
    refetchActive: async () => {},
    prefetchBoot: async () => {},
  });
} catch (e) {
  partialFlushBlocked = true;
  assert.match(e.message, /Không gửi hết thao tác/);
}
assert.equal(partialFlushBlocked, true);
assert.equal(log.filter((x) => x === "invalidate-after-fail").length, 0);

await runReconnectSync({
  flushOutbox: async () => ({ flushed: 0, failed: 0, needsReview: 2 }),
  invalidate: () => log.push("invalidate-needsReview"),
  refetchActive: async () => {},
  prefetchBoot: async () => {},
});
assert.ok(log.includes("invalidate-needsReview"));

let authThrown = false;
let invalidateAfterAuth = 0;
try {
  await runReconnectSync({
    flushOutbox: async () => ({
      flushed: 0,
      failed: 0,
      needsReview: 0,
      authExpired: true,
      forbidden: 0,
    }),
    invalidate: () => {
      invalidateAfterAuth += 1;
    },
    refetchActive: async () => {},
    prefetchBoot: async () => {},
  });
} catch (e) {
  authThrown = true;
  assert.equal(e.message, "AUTH_EXPIRED");
  assert.equal(e.code, "AUTH_EXPIRED");
}
assert.equal(authThrown, true);
assert.equal(invalidateAfterAuth, 0);

console.log("runReconnectSync: ok");
