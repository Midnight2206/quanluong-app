import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  buildPrintProfileFromWorksheet,
  expandDetailRowsWithCarryRows,
  estimateRowHeight,
} from "./chung-tu-excel-print-pagination.js";
import { fillWorkbookForContext, normalizeMapping } from "./chung-tu-excel-template.service.js";

test("estimateRowHeight grows when wrapText column has long text", () => {
  const printProfile = {
    dataRowHeight: 15,
    columnMeta: {
      tenHang: { width: 12, wrapText: true },
      ghiChu: { width: 8, wrapText: false },
    },
  };
  const short = estimateRowHeight({ tenHang: "Gạo" }, printProfile);
  const long = estimateRowHeight(
    { tenHang: "Tên mặt hàng rất dài cần xuống dòng khi in trên template Excel" },
    printProfile,
  );
  assert.ok(long > short);
});

test("expandDetailRowsWithCarryRows inserts carry rows using height budget", () => {
  const printProfile = {
    enabled: true,
    firstPageBodyHeight: 70,
    nextPageBodyHeight: 70,
    carryRowHeight: 15,
    transferRowHeight: 15,
    dataRowHeight: 15,
    amountFieldKey: "thanhTien",
    labelFieldKey: "tenHang",
    carryInLabel: "Mang sang",
    carryOutLabel: "Cộng sang trang",
    columnMeta: {},
  };
  const rows = expandDetailRowsWithCarryRows(
    [
      { stt: 1, tenHang: "A", thanhTien: "10.000" },
      { stt: 2, tenHang: "B", thanhTien: "20.000" },
      { stt: 3, tenHang: "C", thanhTien: "30.000" },
      { stt: 4, tenHang: "D", thanhTien: "40.000" },
      { stt: 5, tenHang: "E", thanhTien: "50.000" },
    ],
    printProfile,
  );

  assert.equal(rows[3].__carryRow, "carry-out");
  assert.equal(rows[3].tenHang, "Cộng sang trang");
  assert.equal(rows[4].__carryRow, "carry-in");
  assert.equal(rows[4].tenHang, "Mang sang");
  assert.equal(rows[5].stt, 4);
});

test("buildPrintProfileFromWorksheet derives page body height from worksheet layout", () => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Mau");
  ws.pageMargins = { top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
  ws.getRow(1).height = 20;
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 20;
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 20;
  ws.getRow(6).height = 20;
  ws.getRow(7).height = 20;
  ws.getRow(8).height = 18;
  ws.getRow(9).height = 16;
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 28;
  ws.getRow(9).getCell(2).alignment = { wrapText: true };

  const profile = buildPrintProfileFromWorksheet(
    ws,
    {
      headerRow: 8,
      startRow: 9,
      templateRow: 9,
      columns: [
        { col: 1, fieldKey: "stt" },
        { col: 2, fieldKey: "tenHang" },
        { col: 3, fieldKey: "thanhTien" },
      ],
    },
    { enabled: true },
  );

  assert.ok(profile.firstPageBodyHeight > 0);
  assert.ok(profile.firstPageBodyHeight < profile.printableHeight);
  assert.equal(profile.columnMeta.tenHang.wrapText, true);
});

test("fillWorkbookForContext inserts carry rows into cloned daily sheets", () => {
  const workbook = new ExcelJS.Workbook();
  const template = workbook.addWorksheet("Mau");
  template.getCell("A8").value = "STT";
  template.getCell("B8").value = "Tên mặt hàng";
  template.getCell("C8").value = "Thành tiền";
  template.getRow(8).height = 18;
  template.getRow(9).height = 16;
  template.getColumn(2).width = 20;
  template.getRow(9).getCell(2).alignment = { wrapText: true };

  const mapping = normalizeMapping({
    table: {
      sheetName: "Mau",
      headerRow: 8,
      startRow: 9,
      templateRow: 9,
      columns: [
        { col: 1, fieldKey: "stt" },
        { col: 2, fieldKey: "tenHang" },
        { col: 3, fieldKey: "thanhTien" },
      ],
    },
    pagination: {
      enabled: true,
      firstPageBodyHeight: 48,
      nextPageBodyHeight: 48,
      carryRowHeight: 16,
      transferRowHeight: 16,
    },
  });

  fillWorkbookForContext({
    workbook,
    mapping,
    context: {
      sheetContexts: [
        {
          sheetName: "01",
          detailRows: [
            { stt: 1, tenHang: "Gạo", thanhTien: 10000 },
            { stt: 2, tenHang: "Thịt", thanhTien: 20000 },
            { stt: 3, tenHang: "Rau", thanhTien: 30000 },
            { stt: 4, tenHang: "Cá", thanhTien: 40000 },
          ],
        },
      ],
    },
  });

  const ws = workbook.getWorksheet("01");
  assert.equal(ws.getCell("B9").value, "Gạo");
  assert.equal(ws.getCell("B10").value, "Thịt");
  assert.equal(ws.getCell("B11").value, "Cộng sang trang");
  assert.equal(ws.getCell("C11").value, 30000);
  assert.equal(ws.getCell("B12").value, "Mang sang");
  assert.equal(ws.getCell("C12").value, 30000);
  assert.equal(ws.getCell("B13").value, "Rau");
  assert.equal(ws.getCell("B14").value, "Cá");
});
