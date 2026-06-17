import test from "node:test";
import assert from "node:assert/strict";

import { normalizeFillRulesV2 } from "./chung-tu-quyet-toan.service.js";

test("normalizeFillRulesV2 keeps pdf print settings with safe defaults", () => {
  const fillRules = normalizeFillRulesV2(
    {
      version: 2,
      sheets: {
        detailTable: {
          columns: ["stt", "tenHang", "thanhTien"],
          pageRowsFirst: 28,
          pageRowsNext: 30,
          carryInLabel: "Mang sang",
          carryOutLabel: "Cộng sang trang",
          amountFieldKey: "thanhTien",
        },
      },
      print: {
        pdf: {
          pageSize: "A4",
          orientation: "portrait",
          marginTopCm: 1.5,
          marginRightCm: 1.2,
          marginBottomCm: 1.3,
          marginLeftCm: 1.2,
          fontSizePt: 11,
          table: {
            headerLabels: ["STT", "Tên hàng", "Thành tiền"],
            amountFieldKey: "thanhTien",
            carryInLabel: "Mang sang",
            carryOutLabel: "Cộng sang trang",
          },
        },
      },
    },
    "spreadsheet",
  );

  assert.equal(fillRules.print.pdf.pageSize, "A4");
  assert.equal(fillRules.print.pdf.orientation, "portrait");
  assert.equal(fillRules.print.pdf.marginTopCm, 1.5);
  assert.equal(fillRules.print.pdf.fontSizePt, 11);
  assert.deepEqual(fillRules.print.pdf.table.headerLabels, ["STT", "Tên hàng", "Thành tiền"]);
  assert.equal(fillRules.print.pdf.table.amountFieldKey, "thanhTien");
  assert.equal(fillRules.print.pdf.table.carryInLabel, "Mang sang");
  assert.equal(fillRules.print.pdf.table.carryOutLabel, "Cộng sang trang");
  assert.equal(fillRules.sheets.detailTable.pageRowsFirst, 28);
  assert.equal(fillRules.sheets.detailTable.pageRowsNext, 30);
  assert.equal(fillRules.sheets.detailTable.amountFieldKey, "thanhTien");
});
