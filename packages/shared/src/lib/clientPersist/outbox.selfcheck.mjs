import assert from "node:assert/strict";
import { isOutboxEligibleError, enqueueOutbox } from "./outbox.js";

assert.equal(isOutboxEligibleError({ status: 503 }), true);
assert.equal(isOutboxEligibleError({ status: 404 }), false);
assert.equal(isOutboxEligibleError(new Error("network")), true);

await assert.rejects(() => enqueueOutbox(), /Dexie adapter/);

console.log("clientPersist/outbox (deprecated): isOutboxEligibleError ok");
