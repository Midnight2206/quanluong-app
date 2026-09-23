/**
 * node packages/shared/src/offline/outbox/conflictReview.selfcheck.mjs
 */
import assert from "node:assert/strict";
import {
  extractServerVersion,
  patchKeepServer,
  patchReapply,
  summarizeConflict,
} from "./conflictReview.js";

const now = "2026-09-23T00:00:00.000Z";
const item = {
  id: "a",
  userId: 1,
  idempotencyKey: "k",
  operation: "update_status",
  entityId: "e1",
  baseVersion: 1,
  payload: { url: "/e1", body: { status: "done" } },
  status: "needs_review",
  retryCount: 0,
  maxRetries: 5,
  createdAt: now,
  updatedAt: now,
};

assert.equal(extractServerVersion({ version: 2 }), 2);
assert.equal(patchKeepServer(item, now).status, "synced");
assert.equal(patchReapply(item, { version: 3 }, now).status, "pending");
assert.equal(patchReapply(item, { version: 3 }, now).baseVersion, 3);

const summary = summarizeConflict(item, { version: 2, status: "open" });
assert.match(summary.localPreview, /done/);
assert.match(summary.serverPreview, /open/);

console.log("offline conflictReview: ok");
