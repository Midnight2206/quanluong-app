import test from "node:test";
import assert from "node:assert/strict";

import { CHUNG_TU_CATEGORY_KEYS, CHUNG_TU_DEFAULT_SHEET_TABLE, getSuggestedColumnSlotsForCategory } from "./chung-tu-category.constants.js";

test("PNK category default does not ship hardcoded columnMappings", () => {
  const def = CHUNG_TU_DEFAULT_SHEET_TABLE[CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO];
  assert.ok(def);
  assert.equal(def.columnMappings, undefined);
  assert.deepEqual(def.columns, ["stt", "tenHang", "dvt", "yeuCau", "thucNhap", "donGia", "thanhTien"]);
});

test("PNK suggested column slots match NHẬP sheet columns A–G", () => {
  const slots = getSuggestedColumnSlotsForCategory(CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO);
  assert.equal(slots.length, 7);
  assert.equal(slots[0].col, 0);
  assert.equal(slots[0].defaultFieldKey, "stt");
  assert.equal(slots[1].col, 1);
  assert.equal(slots[2].col, 2);
  assert.equal(slots[2].defaultFieldKey, "dvt");
  assert.equal(slots[3].col, 3);
  assert.equal(slots[3].defaultFieldKey, "yeuCau");
  assert.equal(slots[4].col, 4);
  assert.equal(slots[4].defaultFieldKey, "thucNhap");
  assert.equal(slots[5].col, 5);
  assert.equal(slots[5].defaultFieldKey, "donGia");
  assert.equal(slots[6].col, 6);
  assert.equal(slots[6].defaultFieldKey, "thanhTien");
});

test("PNK default table starts at data row 13 on NHẬP template", () => {
  const def = CHUNG_TU_DEFAULT_SHEET_TABLE[CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO];
  assert.equal(def.startRow, 13);
  assert.equal(def.templateRow, 13);
  assert.equal(def.totalTemplateRow, 14);
});
