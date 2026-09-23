import assert from "node:assert/strict";
import { pageUiKey, draftKey, normalizeDraftScopeId } from "./keys.js";

assert.equal(pageUiKey(7, "/lttp-nhap-xuat"), "7|/lttp-nhap-xuat");
assert.equal(draftKey(7, "issue-slip", 3), "7|issue-slip|3");
assert.equal(draftKey(7, "ordering-filters", "3"), "7|ordering-filters|3");
assert.equal(draftKey(7, "ct-sig", "cat:bkmh"), "7|ct-sig|cat:bkmh");
assert.equal(draftKey(7, "admin-job", "global"), "7|admin-job|global");
assert.equal(normalizeDraftScopeId(null), null);
assert.equal(normalizeDraftScopeId("global"), "global");
console.log("clientPersist keys: ok");
