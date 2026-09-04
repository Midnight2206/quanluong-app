import assert from "node:assert/strict";
import test from "node:test";
import { getChungTuPdfFieldCatalog } from "./chung-tu-pdf-field-catalog.js";

test("catalog includes FIELD_can_cu_bkmh → canCuBkmh", () => {
  const { scalarFields } = getChungTuPdfFieldCatalog();
  const row = scalarFields.find((f) => f.namedRange === "FIELD_can_cu_bkmh");
  assert.ok(row);
  assert.equal(row.fieldKey, "canCuBkmh");
  assert.match(String(row.label), /căn cứ|BKMH/i);
});
