import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  LTTP_SUPPLIER_TYPE_NAME,
  clearUserLttpSupplierLinks,
  replaceUserLttpSupplierLinks,
  uniqueSupplierIds,
} from "./lttp-supplier.links.js";

test("uniqueSupplierIds keeps first occurrence", () => {
  assert.deepEqual(uniqueSupplierIds([2, 2, 1]), [2, 1]);
});

test("uniqueSupplierIds rejects empty", () => {
  assert.throws(() => uniqueSupplierIds([]), (err) => err.statusCode === 400 && err.message === "Chọn ít nhất một nhà cung cấp.");
});

function fakeDb(rows) {
  const calls = [];
  let inTransaction = false;
  const db = {
    calls,
    transactionEntered: false,
    lttpSupplier: {
      async findMany() {
        return rows;
      },
    },
    userLttpSupplier: {
      async deleteMany(args) {
        calls.push(["delete", args, inTransaction]);
      },
      async createMany(args) {
        calls.push(["create", args, inTransaction]);
      },
    },
    $connect() {},
    async $transaction(fn) {
      db.transactionEntered = true;
      inTransaction = true;
      try {
        return await fn(db);
      } finally {
        inTransaction = false;
      }
    },
  };
  return db;
}

function fakeDbWithoutTransaction(rows) {
  const calls = [];
  return {
    calls,
    lttpSupplier: {
      async findMany() {
        return rows;
      },
    },
    userLttpSupplier: {
      async deleteMany(args) {
        calls.push(["delete", args]);
      },
      async createMany(args) {
        calls.push(["create", args]);
      },
    },
  };
}

test("replace rejects a supplier outside level 1 and does not write", async () => {
  const db = fakeDb([{ id: 5, unit: { depth: 1 } }]);
  await assert.rejects(
    () => replaceUserLttpSupplierLinks(9, [5], db),
    (err) => err.statusCode === 400 && err.message === "Nhà cung cấp không tồn tại hoặc không thuộc đơn vị cấp 1.",
  );
  assert.equal(db.calls.length, 0);
});

test("replace rewrites the exact id set", async () => {
  const db = fakeDb([
    { id: 5, unit: { depth: 0 } },
    { id: 8, unit: { depth: 0 } },
  ]);
  await replaceUserLttpSupplierLinks(9, [5, 5, 8], db);
  assert.equal(db.transactionEntered, true);
  assert.ok(db.calls.every((call) => call[2] === true));
  assert.deepEqual(db.calls[0].slice(0, 2), ["delete", { where: { userId: 9 } }]);
  assert.deepEqual(db.calls[1].slice(0, 2), ["create", { data: [
    { userId: 9, lttpSupplierId: 5 },
    { userId: 9, lttpSupplierId: 8 },
  ] }]);
});

test("replace rewrites links without opening a nested transaction", async () => {
  const db = fakeDbWithoutTransaction([
    { id: 5, unit: { depth: 0 } },
    { id: 8, unit: { depth: 0 } },
  ]);
  await replaceUserLttpSupplierLinks(9, [5, 5, 8], db);
  assert.deepEqual(db.calls, [
    ["delete", { where: { userId: 9 } }],
    ["create", { data: [
      { userId: 9, lttpSupplierId: 5 },
      { userId: 9, lttpSupplierId: 8 },
    ] }],
  ]);
});

test("clear deletes by user", async () => {
  const db = fakeDb([]);
  await clearUserLttpSupplierLinks(4, db);
  assert.deepEqual(db.calls[0].slice(0, 2), ["delete", { where: { userId: 4 } }]);
  assert.equal(db.calls[0][2], false);
});

test("system type name is lttp_supplier and boot upserts it", () => {
  assert.equal(LTTP_SUPPLIER_TYPE_NAME, "lttp_supplier");
  const src = readFileSync(new URL("../auth/auth.service.js", import.meta.url), "utf8");
  assert.match(src, /LTTP_SUPPLIER:\s*"lttp_supplier"/);
  assert.match(src, /name: SYSTEM_TYPE_NAMES\.LTTP_SUPPLIER/);
});
