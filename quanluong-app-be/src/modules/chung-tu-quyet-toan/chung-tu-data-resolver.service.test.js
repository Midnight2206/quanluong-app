import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateLinesToDetailRows,
  resolveDocumentNumberFields,
} from "./chung-tu-data-resolver.service.js";
import { CHUNG_TU_CATEGORY_KEYS } from "./chung-tu-category.constants.js";

test("aggregateLinesToDetailRows sums quantity and amount for same commodity", () => {
  const rows = aggregateLinesToDetailRows([
    {
      commodity: { id: 1, code: "G01", name: "Gạo", measureUnit: "Kg" },
      lttpSupplier: { name: "A" },
      quantity: 2,
      unitPrice: 10000,
      amount: 20000,
    },
    {
      commodity: { id: 1, code: "G01", name: "Gạo", measureUnit: "Kg" },
      lttpSupplier: { name: "B" },
      quantity: 3,
      unitPrice: 10000,
      amount: 30000,
    },
    {
      commodity: { id: 2, code: "T01", name: "Thịt", measureUnit: "Kg" },
      lttpSupplier: { name: "A" },
      quantity: 1,
      unitPrice: 50000,
      amount: 50000,
    },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].tenHang, "Gạo");
  assert.equal(rows[0].soLuong, 5);
  assert.equal(rows[0].thanhTien, "50.000");
  assert.equal(rows[0].donGia, "10.000");
  assert.equal(rows[0].nguoiBan, "A, B");
  assert.equal(rows[1].tenHang, "Thịt");
  assert.equal(rows[1].soLuong, 1);
});

test("aggregateLinesToDetailRows renumbers stt after merge", () => {
  const rows = aggregateLinesToDetailRows([
    {
      commodity: { id: 10, name: "Muối" },
      quantity: 1,
      unitPrice: 1000,
      amount: 1000,
    },
    {
      commodity: { id: 11, name: "Đường" },
      quantity: 2,
      unitPrice: 2000,
      amount: 4000,
    },
  ]);
  assert.deepEqual(
    rows.map((row) => row.stt),
    [1, 2],
  );
});

test("resolveDocumentNumberFields builds quyenSo + day for bang ke", () => {
  const parts = { ngay: "1", thang: "06", nam: "2026" };
  const result = resolveDocumentNumberFields({
    settings: {},
    parts,
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
  });
  assert.equal(result.soChungTu, "062601");
  assert.equal(result.quyenSo, "0626");
});

test("resolveDocumentNumberFields pads single-digit day and keeps two-digit day", () => {
  assert.equal(
    resolveDocumentNumberFields({
      settings: {},
      parts: { ngay: "15", thang: "06", nam: "2026" },
      categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    }).soChungTu,
    "062615",
  );
  assert.equal(
    resolveDocumentNumberFields({
      settings: {},
      parts: { ngay: "01", thang: "06", nam: "2026" },
      categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    }).soChungTu,
    "062601",
  );
});

test("resolveDocumentNumberFields ignores manual overrides for bang ke", () => {
  const parts = { ngay: "15", thang: "06", nam: "2026" };
  const result = resolveDocumentNumberFields({
    settings: { soChungTu: "BK-999", quyenSo: "Q01" },
    parts,
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
  });
  assert.equal(result.soChungTu, "062615");
  assert.equal(result.quyenSo, "0626");
});
