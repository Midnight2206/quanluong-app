import test from "node:test";
import assert from "node:assert/strict";

import { mergeRecipientUnitFillFields } from "./chung-tu-recipient-unit-fill.service.js";
import { resolveLegacyNamedRangeFieldKey } from "./chung-tu-named-range-display.js";
import {
  getDerivedNamedRangeSetForCategory,
  CHUNG_TU_CATEGORY_KEYS,
} from "./chung-tu-category.constants.js";

test("mergeRecipientUnitFillFields writes nguoiNhanHang and donVi", () => {
  const ctx = { sheetName: "DV A" };
  mergeRecipientUnitFillFields(ctx, {
    nguoiNhanHang: "Nguyễn Văn A",
    donVi: "Tiểu đoàn 1",
  });
  assert.equal(ctx.nguoiNhanHang, "Nguyễn Văn A");
  assert.equal(ctx.donVi, "Tiểu đoàn 1");
});

test("legacy named range keys map nguoiNhanHang and donVi", () => {
  assert.equal(resolveLegacyNamedRangeFieldKey("nguoinhanhang"), "nguoiNhanHang");
  assert.equal(resolveLegacyNamedRangeFieldKey("donvi"), "donVi");
  assert.equal(resolveLegacyNamedRangeFieldKey("diachi"), "donVi");
});

test("PXK and PNK include recipient named ranges", () => {
  const pxk = getDerivedNamedRangeSetForCategory(CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO);
  const pnk = getDerivedNamedRangeSetForCategory(CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO);
  assert.ok(pxk.has("nguoiNhanHang"));
  assert.ok(pxk.has("donVi"));
  assert.ok(pnk.has("nguoiNhanHang"));
  assert.ok(pnk.has("donVi"));
  assert.ok(pnk.has("canCuBkmh"));
});
