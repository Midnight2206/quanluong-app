import assert from "node:assert/strict";
import test from "node:test";
import { supplierApproveError } from "./registrations.service.js";

test("nhà cung cấp thiếu đối tác thì không duyệt", () => {
  assert.equal(supplierApproveError({ typeName: "lttp_supplier", lttpSupplierId: null }), "missing_supplier");
});

test("nhân viên không cần đối tác", () => {
  assert.equal(supplierApproveError({ typeName: "user", lttpSupplierId: null }), null);
});
