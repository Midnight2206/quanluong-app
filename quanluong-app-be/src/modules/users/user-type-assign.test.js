import assert from "node:assert/strict";
import test from "node:test";

import { softDeleteActorError, superadminTypeAssignError } from "./user-type-assign.js";

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

test("unit admin cannot soft-delete self or a superadmin", () => {
  assert.equal(
    softDeleteActorError({ actorId: 4, targetId: 4, targetTypeName: "admin", scopeMode: "subtree" }),
    "Không xóa tài khoản đang đăng nhập.",
  );
  assert.equal(
    softDeleteActorError({ actorId: 4, targetId: 1, targetTypeName: "superadmin", scopeMode: "subtree" }),
    "Chỉ superadmin được xóa tài khoản superadmin.",
  );
});

test("superadmin scope may soft-delete another superadmin", () => {
  assert.equal(
    softDeleteActorError({ actorId: 1, targetId: 2, targetTypeName: "superadmin", scopeMode: "all" }),
    null,
  );
});
