import test from "node:test";
import assert from "node:assert/strict";

import {
  NL_FIELD_CATALOG_SCALARS,
  formatCanCuPnkLine,
  formatCanCuPnkText,
  isNlFieldNamedRange,
  resolveNlFieldKey,
} from "./chung-tu-nl-field.js";

test("formatCanCuPnkLine with date and buyerName", () => {
  assert.equal(
    formatCanCuPnkLine({
      soChungTu: "062601",
      periodDate: "2026-06-01",
      buyerName: "Nguyễn Văn A",
    }),
    "Căn cứ vào BKMH số 062601 ngày 01 tháng 06 năm 2026 của đ/c Nguyễn Văn A",
  );
});

test("formatCanCuPnkLine without date", () => {
  assert.equal(
    formatCanCuPnkLine({ soChungTu: "1", buyerName: "A" }),
    "Căn cứ vào BKMH số 1 của đ/c A",
  );
});

test("formatCanCuPnkLine falls back to em dash for blank values", () => {
  assert.equal(
    formatCanCuPnkLine({ soChungTu: "", buyerName: "   " }),
    "Căn cứ vào BKMH số — của đ/c —",
  );
});

test("formatCanCuPnkText joins unique lines with comma", () => {
  assert.equal(
    formatCanCuPnkText([
      { soChungTu: "1", periodDate: "2026-06-01", buyerName: "A" },
      { soChungTu: "1", periodDate: "2026-06-01", buyerName: "A" },
      { soChungTu: "2", periodDate: "2026-06-02", buyerName: "B" },
    ]),
    "Căn cứ vào BKMH số 1 ngày 01 tháng 06 năm 2026 của đ/c A, Căn cứ vào BKMH số 2 ngày 02 tháng 06 năm 2026 của đ/c B",
  );
});

test("resolveNlFieldKey maps NL_FIELD_can_cu_pnk only", () => {
  assert.equal(resolveNlFieldKey("NL_FIELD_can_cu_pnk"), "canCuPnk");
  assert.equal(resolveNlFieldKey("can_cu_pnk"), "canCuPnk");
  assert.equal(resolveNlFieldKey("FIELD_can_cu_bkmh"), "");
});

test("isNlFieldNamedRange recognizes NL prefix", () => {
  assert.equal(isNlFieldNamedRange("NL_FIELD_can_cu_pnk"), true);
  assert.equal(isNlFieldNamedRange("FIELD_can_cu_pnk"), false);
});

test("NL_FIELD_CATALOG_SCALARS exposes canCuPnk as non-label field", () => {
  assert.deepEqual(NL_FIELD_CATALOG_SCALARS, [
    {
      namedRange: "NL_FIELD_can_cu_pnk",
      fieldKey: "canCuPnk",
      description: "Căn cứ PNK hardcoded từ BKMH (số, ngày, người mua)",
      supportsLabel: false,
    },
  ]);
});
