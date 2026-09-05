import assert from "node:assert/strict";
import test from "node:test";
import { resolvePdfScalarFieldKey } from "./chungTuPdfScalarFieldKey.js";
import { resolvePdfScalarFieldKey as resolvePdfScalarFieldKeyFromLabelField } from "./chungTuLabelField.js";

test("chungTuPdfScalarFieldKey re-exports resolvePdfScalarFieldKey from label field", () => {
  assert.equal(resolvePdfScalarFieldKey("FIELD_so"), "soChungTu");
  assert.equal(resolvePdfScalarFieldKey("FIELD_so"), resolvePdfScalarFieldKeyFromLabelField("FIELD_so"));
  assert.equal(
    resolvePdfScalarFieldKey("NL_FIELD_can_cu_pnk"),
    resolvePdfScalarFieldKeyFromLabelField("NL_FIELD_can_cu_pnk"),
  );
});
