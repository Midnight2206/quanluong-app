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
console.log("runReconnectSync: ok");
