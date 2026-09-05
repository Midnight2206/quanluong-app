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
  assert.equal(resolvePdfScalarFieldKey("don_vi"), "donVi");
  assert.equal(resolvePdfScalarFieldKey("FIELD_don_vi"), "donVi");
  assert.equal(resolvePdfScalarFieldKey("NL_FIELD_can_cu_pnk"), "canCuPnk");
  assert.equal(resolvePdfScalarFieldKey("can_cu_pnk"), "canCuPnk");
  assert.equal(resolvePdfScalarFieldKey("FIELD_can_cu_bkmh"), "");
});
