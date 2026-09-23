/**
 * localDraftRegistry selfcheck
 */
import assert from "node:assert/strict";
import {
  clearLocalDraftRegistry,
  defaultLabelForDraftType,
  listLocalDraftEntries,
  removeLocalDraftEntry,
  upsertLocalDraftEntry,
} from "./localDraftRegistry.js";

clearLocalDraftRegistry();
assert.equal(listLocalDraftEntries().length, 0);
assert.equal(defaultLabelForDraftType("issue-slip"), "Phiếu xuất LTTP");

upsertLocalDraftEntry("1|issue-slip|9", { draftType: "issue-slip" });
assert.equal(listLocalDraftEntries().length, 1);
assert.equal(listLocalDraftEntries()[0].label, "Phiếu xuất LTTP");

removeLocalDraftEntry("1|issue-slip|9");
assert.equal(listLocalDraftEntries().length, 0);
console.log("localDraftRegistry: ok");
