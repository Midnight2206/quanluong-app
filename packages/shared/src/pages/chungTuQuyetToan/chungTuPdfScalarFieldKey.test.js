import assert from "node:assert/strict";
import test from "node:test";
import { resolvePdfScalarFieldKey } from "./chungTuPdfScalarFieldKey.js";

test("resolvePdfScalarFieldKey maps so aliases and snake_case", () => {
  assert.equal(resolvePdfScalarFieldKey("so"), "soChungTu");
  assert.equal(resolvePdfScalarFieldKey("FIELD_so"), "soChungTu");
  assert.equal(resolvePdfScalarFieldKey("don_vi"), "donVi");
  assert.equal(resolvePdfScalarFieldKey("FIELD_don_vi"), "donVi");
  assert.equal(resolvePdfScalarFieldKey("NL_FIELD_can_cu_pnk"), "canCuPnk");
  assert.equal(resolvePdfScalarFieldKey("can_cu_pnk"), "canCuPnk");
  assert.equal(resolvePdfScalarFieldKey("FIELD_can_cu_bkmh"), "");
});
