/**
 * node packages/shared/src/offline/outbox/outbox.selfcheck.mjs
 */
import assert from "node:assert/strict";
import { compareBaseVersion } from "./conflict.js";
import { enqueueOutboxItem } from "./enqueue.js";
import { OP_CREATE_ORDER, OP_UPDATE_STATUS } from "./operations.js";
import { backoffMs, flushOutbox } from "./processor.js";

function createMockDb() {
  /** @type {Map<string, object>} */
  const byId = new Map();
  const table = {
    async put(row) {
      byId.set(row.id, { ...row });
    },
    async get(id) {
      return byId.get(id) ?? undefined;
    },
    where(field) {
      return {
        equals(val) {
          const base = [...byId.values()].filter((r) => r[field] === val);
          return {
            filter(fn) {
              return {
                async toArray() {
                  return base.filter(fn);
                },
              };
            },
            async toArray() {
              return base;
            },
          };
        },
      };
    },
  };
  return { table: (name) => (name === "outbox" ? table : table), _rows: byId };
}

assert.equal(compareBaseVersion(3, 3), "match");
assert.equal(compareBaseVersion(3, 4), "mismatch");
assert.equal(backoffMs(2), 4000);

const db = createMockDb();
const apiCalls = [];
const idempotencyKeys = [];

await enqueueOutboxItem(db, {
  userId: 1,
  operation: OP_CREATE_ORDER,
  payload: { url: "/orders", method: "post", body: { x: 1 } },
});

let failOnce = true;
const createResult = await flushOutbox(db, {
  userId: 1,
  sleep: async () => {},
  apiRequest: async (opts) => {
    apiCalls.push(opts);
    idempotencyKeys.push(opts.headers?.["Idempotency-Key"]);
    if (failOnce) {
      failOnce = false;
      throw { status: 503, message: "busy" };
    }
  },
});
assert.equal(createResult.flushed, 0);

const retryResult = await flushOutbox(db, {
  userId: 1,
  sleep: async () => {},
  apiRequest: async (opts) => {
    apiCalls.push(opts);
    idempotencyKeys.push(opts.headers?.["Idempotency-Key"]);
  },
});
assert.equal(retryResult.flushed, 1);
assert.equal(idempotencyKeys.length, 2);
assert.equal(idempotencyKeys[0], idempotencyKeys[1]);

await enqueueOutboxItem(db, {
  userId: 1,
  operation: OP_UPDATE_STATUS,
  entityId: "e1",
  baseVersion: 1,
  payload: { url: "/orders/e1", method: "put", body: { status: "done" } },
});

const reviewResult = await flushOutbox(db, {
  userId: 1,
  sleep: async () => {},
  apiRequest: async () => {},
  handlers: {
    refetchEntity: async () => ({ version: 2 }),
  },
});
assert.equal(reviewResult.needsReview, 1);

const rows = [...db._rows.values()];
const reviewRow = rows.find((r) => r.operation === OP_UPDATE_STATUS);
assert.equal(reviewRow?.status, "needs_review");

// --- 401 bail ---
const db401 = createMockDb();
let calls401 = 0;
await enqueueOutboxItem(db401, {
  userId: 1,
  operation: OP_CREATE_ORDER,
  payload: { url: "/a", method: "post", body: {} },
});
await enqueueOutboxItem(db401, {
  userId: 1,
  operation: OP_CREATE_ORDER,
  payload: { url: "/b", method: "post", body: {} },
});
const r401 = await flushOutbox(db401, {
  userId: 1,
  sleep: async () => {},
  apiRequest: async () => {
    calls401 += 1;
    throw { status: 401, data: { message: "unauthorized" } };
  },
});
assert.equal(r401.authExpired, true);
assert.equal(r401.flushed, 0);
assert.equal(r401.forbidden, 0);
assert.equal(calls401, 1);
const pending401 = [...db401._rows.values()].filter((r) => r.status === "pending");
assert.equal(pending401.length, 2);

// --- 403 continue ---
const db403 = createMockDb();
let urls403 = [];
await enqueueOutboxItem(db403, {
  userId: 1,
  operation: OP_CREATE_ORDER,
  payload: { url: "/deny", method: "post", body: {} },
});
await enqueueOutboxItem(db403, {
  userId: 1,
  operation: OP_CREATE_ORDER,
  payload: { url: "/ok", method: "post", body: {} },
});
const r403 = await flushOutbox(db403, {
  userId: 1,
  sleep: async () => {},
  apiRequest: async (opts) => {
    urls403.push(opts.url);
    if (opts.url === "/deny") {
      throw { status: 403, data: { message: "nope" } };
    }
  },
});
assert.equal(r403.authExpired, false);
assert.equal(r403.forbidden, 1);
assert.equal(r403.failed, 1);
assert.equal(r403.flushed, 1);
assert.deepEqual(urls403, ["/deny", "/ok"]);
const failed403 = [...db403._rows.values()].find((r) => r.payload?.url === "/deny");
assert.equal(failed403?.status, "failed");
assert.match(String(failed403?.lastError), /nope|không có quyền/i);

console.log("offline outbox: ok");
