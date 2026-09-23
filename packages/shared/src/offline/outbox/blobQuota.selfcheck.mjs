/**
 * node packages/shared/src/offline/outbox/blobQuota.selfcheck.mjs
 */
import assert from "node:assert/strict";
import {
  MAX_FILE_BYTES,
  MAX_QUEUE_BLOB_BYTES,
  assertCanEnqueueBlob,
  checkBlobQuota,
} from "./blobQuota.js";
import { enqueueOutboxItem } from "./enqueue.js";
import { OP_UPLOAD_IMAGE } from "./operations.js";
import { flushOutbox } from "./processor.js";

assert.equal(MAX_FILE_BYTES, 8 * 1024 * 1024);
assert.equal(MAX_QUEUE_BLOB_BYTES, 32 * 1024 * 1024);

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
    async toArray() {
      return [...byId.values()];
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

const db = createMockDb();
const blob4 = new Blob([new Uint8Array(4)]);

let quota = await checkBlobQuota(db, 0);
assert.equal(quota.totalBytes, 0);
assert.equal(quota.ok, true);

await enqueueOutboxItem(db, {
  userId: 1,
  operation: OP_UPLOAD_IMAGE,
  payload: { url: "/upload", fileName: "a.png" },
  fileBlob: blob4,
});

quota = await checkBlobQuota(db, 0);
assert.equal(quota.totalBytes, 4);

const huge = new Blob([new Uint8Array(MAX_FILE_BYTES + 1)]);
await assert.rejects(() => assertCanEnqueueBlob(db, huge), /exceeds/);

await db.table("outbox").put({
  id: "fill",
  userId: 1,
  operation: OP_UPLOAD_IMAGE,
  payload: { url: "/u" },
  fileBlob: { size: MAX_QUEUE_BLOB_BYTES - 4 },
  status: "pending",
  retryCount: 0,
  maxRetries: 5,
  idempotencyKey: "k-fill",
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
});
await assert.rejects(() => assertCanEnqueueBlob(db, blob4), /quota exceeded/);

const db2 = createMockDb();
/** @type {FormData|null} */
let capturedForm = null;
await enqueueOutboxItem(db2, {
  userId: 1,
  operation: OP_UPLOAD_IMAGE,
  payload: { url: "/media", fileName: "pic.jpg", formFields: { tag: "x" } },
  fileBlob: new Blob(["img"], { type: "image/jpeg" }),
});

const uploadFlush = await flushOutbox(db2, {
  userId: 1,
  sleep: async () => {},
  apiRequest: async (opts) => {
    assert.equal(opts.headers?.["Idempotency-Key"]?.length > 0, true);
    capturedForm = opts.data;
    return { url: "https://cdn.example/pic.jpg" };
  },
});

assert.equal(uploadFlush.flushed, 1);
assert.ok(capturedForm instanceof FormData);
const row = [...db2._rows.values()][0];
assert.equal(row.status, "synced");
assert.equal(row.fileBlob, null);
assert.equal(row.payload.serverFileUrl, "https://cdn.example/pic.jpg");

console.log("offline blobQuota: ok");
