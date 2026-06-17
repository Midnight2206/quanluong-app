import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  fillWorkbookForContext,
  normalizeMapping,
  parseWorkbookMetadata,
} from "./chung-tu-excel-template.service.js";

test("parseWorkbookMetadata reads sheets and defined names", () => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("01");
  ws.getCell("A1").value = "Ngày";
  ws.getCell("A9").value = "STT";
  ws.getCell("B9").value = "Tên mặt hàng";
  workbook.definedNames.add("ngayThangNam", "'01'!$A$1");

  const metadata = parseWorkbookMetadata(workbook);

  assert.equal(metadata.sheets.length, 1);
  assert.equal(metadata.sheets[0].name, "01");
  assert.equal(metadata.sheets[0].headerRows[0].rowNumber, 9);
  assert.equal(metadata.sheets[0].headerRows[0].cells[0].label, "STT");
});

test("fillWorkbookForContext fills only mapped detail table rows", () => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("01");
  ws.getCell("A1").value = "User tự nhập sẵn";
  workbook.definedNames.add("ngayThangNam", "'01'!$A$1");
  ws.getCell("A9").value = "";
  ws.getCell("B9").value = "";
  ws.getRow(9).height = 20;

  const mapping = normalizeMapping({
    fieldTargets: [{ target: "ngayThangNam", fieldKey: "ngayThangNam" }],
    table: {
      sheetName: "01",
      startRow: 9,
      templateRow: 9,
      columns: [
        { col: 1, fieldKey: "stt" },
        { col: 2, fieldKey: "tenHang" },
      ],
    },
  });

  fillWorkbookForContext({
    workbook,
    mapping,
    context: {
      ngayThangNam: "Ngày 01 tháng 06 năm 2026",
      detailRows: [
        { stt: 1, tenHang: "Gạo" },
        { stt: 2, tenHang: "Thịt" },
      ],
    },
  });

  assert.equal(ws.getCell("A1").value, "User tự nhập sẵn");
  assert.equal(ws.getCell("A9").value, 1);
  assert.equal(ws.getCell("B9").value, "Gạo");
  assert.equal(ws.getCell("A10").value, 2);
  assert.equal(ws.getCell("B10").value, "Thịt");
});

test("fillWorkbookForContext clones one template sheet into daily sheets", () => {
  const workbook = new ExcelJS.Workbook();
  const template = workbook.addWorksheet("Mau");
  template.getCell("A1").value = "Header giữ nguyên";
  template.getCell("A9").value = "";
  template.getCell("B9").value = "";
  template.getRow(9).height = 22;

  const mapping = normalizeMapping({
    table: {
      sheetName: "Mau",
      startRow: 9,
      templateRow: 9,
      columns: [
        { col: 1, fieldKey: "stt" },
        { col: 2, fieldKey: "tenHang" },
      ],
    },
  });

  fillWorkbookForContext({
    workbook,
    mapping,
    context: {
      sheetContexts: [
        { sheetName: "01", detailRows: [{ stt: 1, tenHang: "Gạo" }] },
        { sheetName: "02", detailRows: [{ stt: 1, tenHang: "Thịt" }] },
      ],
    },
  });

  assert.equal(workbook.getWorksheet("Mau"), undefined);
  assert.equal(workbook.getWorksheet("01").getCell("A1").value, "Header giữ nguyên");
  assert.equal(workbook.getWorksheet("01").getCell("B9").value, "Gạo");
  assert.equal(workbook.getWorksheet("02").getCell("B9").value, "Thịt");
});
