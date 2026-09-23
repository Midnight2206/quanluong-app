/**
 * node packages/shared/src/offline/db/openOfflineDb.selfcheck.mjs
 */
import assert from "node:assert/strict";
import { offlineDbName } from "./openOfflineDb.js";

assert.equal(offlineDbName(7), "quanluong-offline-u7");
assert.equal(offlineDbName("42"), "quanluong-offline-u42");

console.log("offline openOfflineDb: ok");
