import assert from "node:assert/strict";
import test from "node:test";

import { grantedPermissionRecords } from "./auth-granted-permissions.js";

const read = { id: 1, code: "lttp.issue-slips.read" };
const write = { id: 2, code: "lttp.issue-slips.write" };

test("job title replaces type permissions for admin", () => {
  const granted = grantedPermissionRecords(
    { type: { name: "admin" }, jobTitleId: 4 },
    [read, write],
    [read],
  );
  assert.deepEqual(granted.map((p) => p.code), ["lttp.issue-slips.read"]);
});

test("admin without a job title keeps type permissions", () => {
  const granted = grantedPermissionRecords(
    { type: { name: "admin" }, jobTitleId: null },
    [read, write],
    [],
  );
  assert.deepEqual(granted.map((p) => p.code), [
    "lttp.issue-slips.read",
    "lttp.issue-slips.write",
  ]);
});

test("superadmin keeps type permissions even with a job title", () => {
  const granted = grantedPermissionRecords(
    { type: { name: "superadmin" }, jobTitleId: 4 },
    [read, write],
    [read],
  );
  assert.deepEqual(granted.map((p) => p.code), [
    "lttp.issue-slips.read",
    "lttp.issue-slips.write",
  ]);
});
