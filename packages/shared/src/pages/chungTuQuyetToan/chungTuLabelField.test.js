import assert from "node:assert/strict";
import test from "node:test";
import {
  isLabelFieldNamedRange,
  resolvePdfScalarFieldKey,
} from "./chungTuLabelField.js";

test("isLabelFieldNamedRange matches only FIELD named ranges", () => {
  assert.equal(isLabelFieldNamedRange("FIELD_so"), true);
  assert.equal(isLabelFieldNamedRange("NL_FIELD_can_cu_pnk"), false);
  assert.equal(isLabelFieldNamedRange("so"), false);
});

test("resolvePdfScalarFieldKey keeps scalar aliases and NL mapping", () => {
  assert.equal(resolvePdfScalarFieldKey("so"), "soChungTu");
  assert.equal(resolvePdfScalarFieldKey("FIELD_so"), "soChungTu");
  assert.equal(resolvePdfScalarFieldKey("NL_FIELD_don_vi"), "donVi");
  assert.equal(resolvePdfScalarFieldKey("NL_FIELD_don_vi_cap_tren"), "donViCapTren");
  assert.equal(resolvePdfScalarFieldKey("NL_FIELD_ngay_thang_nam"), "ngayThangNam");
  assert.equal(resolvePdfScalarFieldKey("don_vi"), "donVi");
  assert.equal(resolvePdfScalarFieldKey("FIELD_don_vi"), "");
  assert.equal(resolvePdfScalarFieldKey("FIELD_don_vi_cap_tren"), "");
  assert.equal(resolvePdfScalarFieldKey("FIELD_ngay_thang_nam"), "");
  assert.equal(resolvePdfScalarFieldKey("ly_do_nhap_kho"), "lyDoNhapKho");
  assert.equal(resolvePdfScalarFieldKey("FIELD_ly_do_nhap_kho"), "lyDoNhapKho");
  assert.equal(resolvePdfScalarFieldKey("NL_FIELD_can_cu_pnk"), "canCuPnk");
  assert.equal(resolvePdfScalarFieldKey("can_cu_pnk"), "canCuPnk");
  assert.equal(resolvePdfScalarFieldKey("FIELD_can_cu_bkmh"), "");
});
