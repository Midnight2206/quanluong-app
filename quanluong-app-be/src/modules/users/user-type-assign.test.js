import assert from "node:assert/strict";
import test from "node:test";

import { superadminTypeAssignError } from "./user-type-assign.js";

test("unit admin cannot assign the superadmin type", () => {
  assert.equal(
    superadminTypeAssignError("superadmin", "subtree"),
    "Chỉ superadmin được gán loại tài khoản superadmin.",
  );
});

test("superadmin scope may assign the superadmin type", () => {
  assert.equal(superadminTypeAssignError("superadmin", "all"), null);
});

test("admin type stays assignable inside a unit", () => {
  assert.equal(superadminTypeAssignError("admin", "subtree"), null);
});
