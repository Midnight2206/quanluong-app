/** @deprecated X1 IDB outbox — use Dexie via @/offline/adapters/lttp */
export { isOutboxEligibleError } from "../../offline/adapters/lttp/lttpOutboxOps.js";

/** @deprecated requires Dexie db — use enqueueLttpIssueSlipCreate from lttpOutboxOps */
export async function enqueueOutbox() {
  throw new Error("clientPersist/outbox: use offline Dexie adapter (lttpOutboxOps)");
}
