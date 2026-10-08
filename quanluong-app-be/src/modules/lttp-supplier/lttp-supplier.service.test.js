import assert from "node:assert/strict";
import test from "node:test";
import {
  listLttpSupplierCatalog,
  listLttpSupplierLinks,
  readLttpSupplierOrders,
} from "./lttp-supplier.service.js";
import { ordersQuerySchema } from "./lttp-supplier.validator.js";

test("orders query rejects a bad date", () => {
  assert.equal(ordersQuerySchema.safeParse({ date: "08-10-2026", supplierId: "3" }).success, false);
  assert.equal(ordersQuerySchema.safeParse({ date: "2026-10-08", supplierId: "3" }).success, true);
});

test("links map the signed-in user only", async () => {
  const db = {
    userLttpSupplier: {
      async findMany(args) {
        assert.equal(args.where.userId, 4);
        return [{
          lttpSupplier: { id: 8, name: "Công ty A", unit: { id: 10, name: "Kho 1", depth: 0 } },
        }];
      },
    },
  };
  assert.deepEqual(await listLttpSupplierLinks(4, db), {
    links: [{ supplierId: 8, supplierName: "Công ty A", level1UnitId: 10, level1UnitName: "Kho 1" }],
  });
});

test("catalog drops suppliers outside level 1", async () => {
  const db = {
    lttpSupplier: {
      async findMany(args) {
        assert.equal(args.where.unit.depth, 0);
        return [{ id: 2, name: "B", unit: { id: 1, name: "Kho", depth: 0 } }];
      },
    },
  };
  const data = await listLttpSupplierCatalog(db);
  assert.equal(data.suppliers[0].id, 2);
  assert.equal(data.suppliers[0].level1UnitName, "Kho");
});

test("orders 404 when the supplier is not linked and does not summarize", async () => {
  let called = false;
  const db = {
    userLttpSupplier: { async findFirst() { return null; } },
  };
  await assert.rejects(
    () => readLttpSupplierOrders({
      userId: 4,
      supplierId: 9,
      date: "2026-10-08",
      db,
      summarize() { called = true; },
    }),
    (err) => err.statusCode === 404 && err.message === "Không thấy nhà cung cấp của tài khoản này.",
  );
  assert.equal(called, false);
});

test("orders summarize one linked supplier storage unit", async () => {
  const db = {
    userLttpSupplier: {
      async findFirst(args) {
        assert.equal(args.where.userId, 4);
        assert.equal(args.where.lttpSupplierId, 8);
        return { lttpSupplier: { id: 8, unitId: 10 } };
      },
    },
  };
  const data = await readLttpSupplierOrders({
    userId: 4,
    supplierId: 8,
    date: "2026-10-08",
    db,
    summarize(payload, scope, effectiveUnitIds, dataScope) {
      assert.deepEqual(payload, { unitId: 10, date: "2026-10-08", supplierFilter: 8 });
      assert.equal(scope.mode, "all");
      assert.equal(effectiveUnitIds, null);
      assert.deepEqual(dataScope, { storageUnitId: 10, logicalUnitId: 10 });
      return { slipColumns: [], grandTotals: [] };
    },
  });
  assert.deepEqual(data, { slipColumns: [], grandTotals: [] });
});
