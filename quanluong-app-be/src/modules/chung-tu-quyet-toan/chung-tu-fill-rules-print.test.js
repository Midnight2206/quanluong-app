import test from "node:test";
import assert from "node:assert/strict";

import { normalizeFillRulesV2 } from "./chung-tu-quyet-toan.service.js";

test("normalizeFillRulesV2 keeps sheet print settings with safe defaults", () => {
  const fillRules = normalizeFillRulesV2(
    {
      version: 2,
      sheets: {
        detailTable: {
          columns: ["stt", "tenHang", "thanhTien"],
          rowHeightPt: 18,
          amountFieldKey: "thanhTien",
        },
      },
      print: {
        sheets: {
          rowHeightPt: 18,
        },
      },
    },
    "spreadsheet",
  );

  assert.equal(fillRules.sheets.detailTable.rowHeightPt, 18);
  assert.equal(fillRules.print.sheets.rowHeightPt, 18);
  assert.equal(fillRules.sheets.detailTable.amountFieldKey, "thanhTien");
  assert.equal(fillRules.print.pdf, undefined);
});
