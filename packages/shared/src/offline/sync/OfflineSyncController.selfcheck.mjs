import assert from "node:assert/strict";
import { createOfflineSyncController } from "./OfflineSyncController.js";

let calls = 0;
let release;
const gate = new Promise((r) => {
  release = r;
});

const fakeDb = {};
const controller = createOfflineSyncController({
  db: fakeDb,
  userId: 1,
  apiRequest: async () => ({}),
  getHandlers: () => ({}),
  // test seam — if not present, selfcheck imports a testable flush inject:
  _flushOutboxForTest: async () => {
    calls += 1;
    await gate;
    return { flushed: 2, failed: 0, needsReview: 0 };
  },
  // ponytail: probe-gated getNetworkOnline is false in Node until async probe; noop subscribe avoids extra flush
  getNetworkOnlineFn: () => true,
  subscribeNetworkStatusFn: () => () => {},
});

controller.start();
const p1 = controller.flush();
const p2 = controller.flush();
assert.equal(p1, p2);
release();
const [a, b] = await Promise.all([p1, p2]);
assert.equal(a.flushed, 2);
assert.equal(b.flushed, 2);
assert.equal(calls, 1);
console.log("OfflineSyncController: ok");
