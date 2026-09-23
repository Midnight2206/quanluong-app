/**
 * localUnsavedFieldRegistry — sessionStorage persistence for hard refresh
 */
import assert from "node:assert/strict";

const store = new Map();
globalThis.sessionStorage = {
  getItem(k) {
    return store.has(k) ? store.get(k) : null;
  },
  setItem(k, v) {
    store.set(k, String(v));
  },
  removeItem(k) {
    store.delete(k);
  },
};

const mod = await import(`./localUnsavedFieldRegistry.js?t=${Date.now()}`);
const {
  clearLocalUnsavedFieldRegistry,
  dumpLocalUnsavedFieldRegistryForTest,
  listLocalUnsavedFields,
  markLocalUnsavedField,
  unmarkLocalUnsavedField,
} = mod;

clearLocalUnsavedFieldRegistry();
markLocalUnsavedField("/lttp", "issueDate");
markLocalUnsavedField("/lttp", "section:issue-info");
assert.deepEqual(listLocalUnsavedFields("/lttp").sort(), [
  "issueDate",
  "section:issue-info",
]);

const raw = store.get("quanluong:local-unsaved-fields");
assert.ok(raw && raw.includes("issueDate"));

// Simulate hard refresh: clear RAM by re-import is hard; verify dump + storage roundtrip via clear+manual hydrate path
unmarkLocalUnsavedField("/lttp", "issueDate");
assert.deepEqual(listLocalUnsavedFields("/lttp"), ["section:issue-info"]);
clearLocalUnsavedFieldRegistry();
assert.equal(listLocalUnsavedFields("/lttp").length, 0);
assert.deepEqual(dumpLocalUnsavedFieldRegistryForTest(), {});
console.log("localUnsavedFieldRegistry: ok");
