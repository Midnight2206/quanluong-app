/**
 * Contract: logout draft guard lists content drafts and uses confirm API shape.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearLocalDraftRegistry,
  listLocalDraftEntries,
  upsertLocalDraftEntry,
} from "../../../lib/clientPersist/localDraftRegistry.js";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "useLogoutWithDraftGuard.js"),
  "utf8",
);

assert.match(src, /listLocalDraftEntries/);
assert.match(src, /Đăng xuất và xoá bộ nhớ tạm/);
assert.match(src, /Huỷ/);
assert.match(src, /variant:\s*"danger"/);

clearLocalDraftRegistry();
assert.equal(listLocalDraftEntries().length, 0);
upsertLocalDraftEntry("1|issue-slip|9", { draftType: "issue-slip" });
assert.equal(listLocalDraftEntries().length, 1);
clearLocalDraftRegistry();
console.log("useLogoutWithDraftGuard contract: ok");
