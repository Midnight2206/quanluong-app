import test from "node:test";
import assert from "node:assert/strict";

import {
  CHUNG_TU_CATEGORY_KEYS,
  CHUNG_TU_DEFAULT_SHEET_TABLE,
  getSuggestedColumnSlotsForCategory,
} from "./chung-tu-category.constants.js";

test("PXK suggested column slots match columns A,B,E,F,G,H,I,J", () => {
  const slots = getSuggestedColumnSlotsForCategory(CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO);
  assert.equal(slots.length, 8);
  assert.deepEqual(
    slots.map((slot) => slot.col),
    [0, 1, 4, 5, 6, 7, 8, 9],
  );
  assert.equal(slots[2].defaultFieldKey, "maSo");
  assert.equal(slots[4].defaultFieldKey, "yeuCau");
  assert.equal(slots[5].defaultFieldKey, "thucXuat");
});

test("PXK default table uses yeuCau and thucXuat columns", () => {
  const def = CHUNG_TU_DEFAULT_SHEET_TABLE[CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO];
  assert.deepEqual(def.columns, [
    "stt",
    "tenHang",
    "maSo",
    "dvt",
    "yeuCau",
    "thucXuat",
    "donGia",
    "thanhTien",
  ]);
});
