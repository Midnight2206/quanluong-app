import assert from "node:assert/strict";
import test from "node:test";
import { isNlFieldNamedRange, resolveNlFieldKey } from "./chungTuNlField.js";

test("isNlFieldNamedRange matches only NL_FIELD named ranges", () => {
  assert.equal(isNlFieldNamedRange("NL_FIELD_can_cu_pnk"), true);
  assert.equal(isNlFieldNamedRange("FIELD_so"), false);
  assert.equal(isNlFieldNamedRange("can_cu_pnk"), false);
});

test("resolveNlFieldKey maps can_cu_pnk and rejects legacy FIELD aliases", () => {
  assert.equal(resolveNlFieldKey("NL_FIELD_can_cu_pnk"), "canCuPnk");
  assert.equal(resolveNlFieldKey("can_cu_pnk"), "canCuPnk");
  assert.equal(resolveNlFieldKey("FIELD_can_cu_bkmh"), "");
});

test("resolveNlFieldKey maps shared unit/date NL fields only", () => {
  assert.equal(resolveNlFieldKey("NL_FIELD_don_vi"), "donVi");
  assert.equal(resolveNlFieldKey("NL_FIELD_don_vi_cap_tren"), "donViCapTren");
  assert.equal(resolveNlFieldKey("NL_FIELD_ngay_thang_nam"), "ngayThangNam");
  assert.equal(resolveNlFieldKey("don_vi"), "donVi");
  assert.equal(resolveNlFieldKey("don_vi_cap_tren"), "donViCapTren");
  assert.equal(resolveNlFieldKey("ngay_thang_nam"), "ngayThangNam");
  assert.equal(resolveNlFieldKey("FIELD_don_vi"), "");
  assert.equal(resolveNlFieldKey("FIELD_don_vi_cap_tren"), "");
  assert.equal(resolveNlFieldKey("FIELD_ngay_thang_nam"), "");
});
