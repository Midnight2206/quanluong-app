/**
 * node packages/shared/src/pages/kitchen-books/kitchenBooksSessionPersist.selfcheck.mjs
 */
import assert from "node:assert/strict";

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const mod = await import("./kitchenBooksSessionPersist.js");

assert.equal(mod.readStoredKitchenManualUnitId(), null);
mod.writeStoredKitchenManualUnitId(3);
assert.equal(mod.readStoredKitchenManualUnitId(), 3);
mod.writeStoredKitchenManualUnitId(null);
assert.equal(mod.readStoredKitchenManualUnitId(), null);

mod.writeStoredKitchenReceiptDate("2026-06-23");
assert.equal(mod.readStoredKitchenReceiptDate(), "2026-06-23");
mod.writeStoredKitchenReceiptDate("bad");
assert.equal(mod.readStoredKitchenReceiptDate(), null);

mod.writeStoredKitchenMenuDate("2026-07-01");
assert.equal(mod.readStoredKitchenMenuDate(), "2026-07-01");
mod.writeStoredKitchenYearMonth("2026-07");
assert.equal(mod.readStoredKitchenYearMonth(), "2026-07");

console.log("kitchenBooksSessionPersist.selfcheck: ok");
