/**
 * node packages/shared/src/offline/adapters/lttp/lttpOutboxOps.selfcheck.mjs
 */
import assert from "node:assert/strict";
import { flushOutbox } from "../../outbox/processor.js";
import { OP_LTTP_ISSUE_SLIP_CREATE, OP_LTTP_ISSUE_SLIP_UPDATE } from "../../outbox/operations.js";
import {
  createLttpOutboxHandlers,
  enqueueLttpIssueSlipCreate,
  enqueueLttpIssueSlipUpdate,
  issueSlipBaseVersion,
} from "./lttpOutboxOps.js";

function createMockDb() {
  /** @type {Map<string, object>} */
  const byId = new Map();
  const table = {
    async put(row) {
      byId.set(row.id, { ...row });
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

assert.equal(issueSlipBaseVersion({ id: 9, updatedAt: "2026-01-01T00:00:00.000Z" }), "2026-01-01T00:00:00.000Z");
assert.equal(issueSlipBaseVersion({ version: 2, updatedAt: "x" }), 2);

const db = createMockDb();
await enqueueLttpIssueSlipCreate(db, 3, { unitId: 1, issueDate: "2026-01-02" });
const posts = [];
const createFlush = await flushOutbox(db, {
  userId: 3,
  sleep: async () => {},
  apiRequest: async (opts) => {
    posts.push(opts);
  },
  handlers: createLttpOutboxHandlers(async () => ({})),
});
assert.equal(createFlush.flushed, 1);
assert.equal(posts[0].url, "/lttp/issue-slips");
assert.equal(posts[0].method, "post");
assert.ok(posts[0].headers?.["Idempotency-Key"]);

await enqueueLttpIssueSlipUpdate(
  db,
  3,
  42,
  { note: "x" },
  issueSlipBaseVersion({ id: 42, updatedAt: "2026-01-01T00:00:00.000Z" }),
);
const review = await flushOutbox(db, {
  userId: 3,
  sleep: async () => {},
  apiRequest: async () => {},
  handlers: createLttpOutboxHandlers(async () => ({})),
});
assert.equal(review.needsReview, 1);

const row = [...db._rows.values()].find((r) => r.operation === OP_LTTP_ISSUE_SLIP_UPDATE);
assert.equal(row?.operation, OP_LTTP_ISSUE_SLIP_UPDATE);
assert.equal(row?.payload?.refetchUrl, "/lttp/issue-slips/42");

console.log("lttpOutboxOps: create flush + update needs_review ok");
