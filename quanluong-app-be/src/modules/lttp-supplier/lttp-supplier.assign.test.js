import assert from "node:assert/strict";
import test from "node:test";
import {
  blankUnitFieldsForSupplier,
  syncLttpSupplierAssignment,
} from "./lttp-supplier.links.js";

test("blankUnitFieldsForSupplier clears unit fields", () => {
  assert.deepEqual(
    blankUnitFieldsForSupplier("lttp_supplier", {
      unitId: 3,
      assignedUnitId: 4,
      jobTitleId: 5,
      username: "a",
    }),
    { unitId: null, assignedUnitId: null, jobTitleId: null, username: "a" },
  );
  assert.deepEqual(blankUnitFieldsForSupplier("admin", { unitId: 3 }), {
    unitId: 3,
  });
});

test("sync on create requires supplier ids", async () => {
  const db = { calls: [] };
  await assert.rejects(
    () =>
      syncLttpSupplierAssignment(
        1,
        { nextTypeName: "lttp_supplier", mode: "create", supplierIds: undefined },
        db,
      ),
    (err) =>
      err.statusCode === 400 && err.message === "Chọn ít nhất một nhà cung cấp.",
  );
});

test("sync on patch without supplierIds keeps links", async () => {
  const db = { calls: [] };
  await syncLttpSupplierAssignment(
    1,
    { nextTypeName: "lttp_supplier", mode: "patch", supplierIds: undefined },
    db,
  );
  assert.equal(db.calls.length, 0);
});

test("sync away from supplier clears links", async () => {
  const db = {
    calls: [],
    userLttpSupplier: {
      async deleteMany(args) {
        db.calls.push(args);
      },
    },
  };
  await syncLttpSupplierAssignment(
    7,
    { nextTypeName: "user", mode: "patch", supplierIds: [1] },
    db,
  );
  assert.deepEqual(db.calls, [{ where: { userId: 7 } }]);
});
