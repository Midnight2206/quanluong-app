import assert from "node:assert/strict";
import test from "node:test";
import {
  supplierCreateBlockReason,
  supplierCreateBody,
  supplierEditBlockReason,
  supplierEditPatch,
  supplierIdsFromLinks,
} from "./supplierUserForm.js";

const filled = {
  username: " ncc ",
  email: " ncc@example.com ",
  password: "12345678",
  fullName: " Nhà cung cấp ",
  typeId: "9",
  unitId: "3",
};

test("create supplier account blocks an empty selection and sends a null unit", () => {
  assert.equal(
    supplierCreateBlockReason({
      ...filled,
      isSupplierCreateType: true,
      catalogFailed: true,
      supplierIds: [],
    }),
    "Không tải được danh sách nhà cung cấp.",
  );
  assert.equal(
    supplierCreateBlockReason({
      ...filled,
      isSupplierCreateType: true,
      supplierIds: [],
    }),
    "Chọn ít nhất một nhà cung cấp.",
  );
  assert.equal(
    supplierCreateBlockReason({
      ...filled,
      isSupplierCreateType: false,
      supplierIds: [],
    }),
    null,
  );
  assert.deepEqual(
    supplierCreateBody({
      ...filled,
      isSupplierCreateType: true,
      supplierIds: [4, 5],
    }),
    {
      username: "ncc",
      email: "ncc@example.com",
      password: "12345678",
      typeId: 9,
      unitId: null,
      supplierIds: [4, 5],
      profile: { fullName: "Nhà cung cấp" },
    },
  );
  const other = supplierCreateBody({
    ...filled,
    isSupplierCreateType: false,
    supplierIds: [4],
  });
  assert.equal(other.unitId, 3);
  assert.equal(Object.hasOwn(other, "supplierIds"), false);
});

test("create body sends phone except for superadmin and never phoneVerifiedAt", () => {
  const withPhone = supplierCreateBody({
    ...filled,
    isSupplierCreateType: false,
    supplierIds: [],
    phoneNumber: " 0901 ",
    includePhone: true,
  });
  assert.equal(withPhone.profile.phoneNumber, "0901");
  assert.equal(Object.hasOwn(withPhone, "phoneVerifiedAt"), false);
  assert.equal(Object.hasOwn(withPhone.profile, "phoneVerifiedAt"), false);

  const superadmin = supplierCreateBody({
    ...filled,
    isSupplierCreateType: false,
    phoneNumber: "0901",
    includePhone: false,
  });
  assert.equal(Object.hasOwn(superadmin.profile, "phoneNumber"), false);
  assert.equal(Object.hasOwn(superadmin, "phoneVerifiedAt"), false);
});

test("edit supplier links prefills ids and patches the selected set", () => {
  assert.deepEqual(
    supplierIdsFromLinks({ links: [{ supplierId: 2 }, { supplierId: "x" }, {}] }),
    [2],
  );
  assert.deepEqual(supplierIdsFromLinks({}), []);
  assert.equal(supplierEditBlockReason([]), "Chọn ít nhất một nhà cung cấp.");
  assert.equal(supplierEditBlockReason([2]), null);
  assert.deepEqual(supplierEditPatch(7, [2, 3]), { id: 7, supplierIds: [2, 3] });
});
