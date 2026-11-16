import assert from "node:assert/strict";
import test from "node:test";
import {
  isSupplierAppPath,
  resolveZaloPortal,
  SUPPLIER_DEFAULT_HOME,
  SUPPLIER_INVOICE_PATH,
  SUPPLIER_LEDGER_PATH,
  SUPPLIER_ORDER_PATH,
  supplierPath,
} from "./supplierPortal.js";

test("supplier path helpers use flat /ncc-* routes and home /", () => {
  assert.equal(SUPPLIER_DEFAULT_HOME, "/");
  assert.equal(supplierPath(), "/");
  assert.equal(supplierPath("dat-hang"), "/ncc-dathang");
  assert.equal(supplierPath("so-cong-no"), "/ncc-congno");
  assert.equal(supplierPath("hoa-don"), "/ncc-hoadon");
  assert.equal(SUPPLIER_ORDER_PATH, "/ncc-dathang");
  assert.equal(SUPPLIER_LEDGER_PATH, "/ncc-congno");
  assert.equal(SUPPLIER_INVOICE_PATH, "/ncc-hoadon");
});

test("isSupplierAppPath matches flat and legacy /ncc paths", () => {
  assert.equal(isSupplierAppPath("/ncc-dathang"), true);
  assert.equal(isSupplierAppPath("/ncc-congno"), true);
  assert.equal(isSupplierAppPath("/ncc-hoadon"), true);
  assert.equal(isSupplierAppPath("/ncc"), true);
  assert.equal(isSupplierAppPath("/ncc/dat-hang"), true);
  assert.equal(isSupplierAppPath("/"), false);
  assert.equal(isSupplierAppPath("/dashboard"), false);
});

test("resolveZaloPortal uses /ncc-* path not separate origin", () => {
  assert.equal(resolveZaloPortal({ pathname: "/ncc-dathang" }), "supplier");
  assert.equal(resolveZaloPortal({ from: "/ncc-congno" }), "supplier");
  assert.equal(resolveZaloPortal({ pathname: "/profile" }), "main");
});
