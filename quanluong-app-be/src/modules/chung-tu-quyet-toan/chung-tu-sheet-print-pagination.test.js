import test from "node:test";
import assert from "node:assert/strict";

import {
  buildChungTuSheetPrintRowsWithWrap,
  buildPaginatedPlacements,
  buildPerRowHeightUpdateRequests,
  buildSheetPrintOutput,
  estimateRowUnits,
  expandDetailRowsWithCarryRows,
  normalizeSheetPrintConfig,
} from "./chung-tu-sheet-print-pagination.js";

test("normalizeSheetPrintConfig defaults to 40 rows and 18pt", () => {
  const cfg = normalizeSheetPrintConfig({}, {});
  assert.equal(cfg.rowsPerPage, 40);
  assert.equal(cfg.rowHeightPt, 18);
  assert.equal(cfg.enabled, true);
});

test("estimateRowUnits scales row height for wrapped text", () => {
  const columns = ["tenHang", "ghiChu"];
  const columnMeta = {
    tenHang: { width: 70, wrapText: true },
    ghiChu: { width: 70, wrapText: false },
  };
  const short = estimateRowUnits({ tenHang: "Gạo" }, columns, columnMeta);
  const long = estimateRowUnits(
    { tenHang: "Tên hàng rất dài cần xuống nhiều dòng khi in" },
    columns,
    columnMeta,
  );
  assert.equal(short, 1);
  assert.ok(long > 1);
});

test("estimateRowUnits reduces how many rows fit before carry-out", () => {
  const columns = ["stt", "tenHang", "thanhTien"];
  const printProfile = {
    enabled: true,
    rowsPerPage: 10,
    rowHeightPt: 18,
    amountFieldKey: "thanhTien",
    labelFieldKey: "tenHang",
    carryInLabel: "Mang sang",
    carryOutLabel: "Cộng sang trang",
    columnMeta: {
      tenHang: { width: 70, wrapText: true },
      thanhTien: { width: 72, wrapText: false },
    },
  };
  const longName = "123456789012345678901234567890";
  const detailRows = [
    ...Array.from({ length: 7 }, (_, i) => ({
      stt: i + 1,
      tenHang: `Hàng ${i + 1}`,
      thanhTien: "1.000",
    })),
    { stt: 8, tenHang: longName, thanhTien: "1.000" },
    { stt: 9, tenHang: "Hàng 9", thanhTien: "1.000" },
  ];
  const units = estimateRowUnits(detailRows[7], columns, printProfile.columnMeta);
  assert.equal(units, 3);
  const { pages, placements } = buildPaginatedPlacements(detailRows, printProfile, columns);
  assert.equal(pages[0].rows.length, 7);
  assert.ok(pages[0].carryOut != null);
  assert.equal(pages[1].rows[0].stt, 8);
  const carryOutPage1 = placements.find((p) => p.rowOffset === 9);
  const carryInPage2 = placements.find((p) => p.rowOffset === 10);
  assert.ok(carryOutPage1);
  assert.ok(carryInPage2);
  assert.equal(carryOutPage1.values[1], "Cộng sang trang");
  assert.equal(carryInPage2.values[1], "Mang sang");
});

test("buildPaginatedPlacements pins carry rows to fixed page slots", () => {
  const columns = ["stt", "tenHang", "thanhTien"];
  const printProfile = {
    enabled: true,
    rowsPerPage: 40,
    rowHeightPt: 18,
    amountFieldKey: "thanhTien",
    labelFieldKey: "tenHang",
    carryInLabel: "Mang sang",
    carryOutLabel: "Cộng sang trang",
    columnMeta: {
      tenHang: { width: 72, wrapText: false },
      thanhTien: { width: 72, wrapText: false },
    },
  };
  const detailRows = Array.from({ length: 50 }, (_, i) => ({
    stt: i + 1,
    tenHang: `Hàng ${i + 1}`,
    thanhTien: "1.000",
  }));
  const { placements, totalRowSpan } = buildPaginatedPlacements(detailRows, printProfile, columns);
  const carryOutPage1 = placements.find((p) => p.rowOffset === 39);
  const carryInPage2 = placements.find((p) => p.rowOffset === 40);
  assert.ok(carryOutPage1);
  assert.ok(carryInPage2);
  assert.equal(carryOutPage1.values[1], "Cộng sang trang");
  assert.equal(carryInPage2.values[1], "Mang sang");
  assert.equal(totalRowSpan, 52);
});

test("expandDetailRowsWithCarryRows respects 40-row page budget", () => {
  const columns = ["stt", "tenHang", "thanhTien"];
  const printProfile = {
    enabled: true,
    rowsPerPage: 40,
    rowHeightPt: 18,
    amountFieldKey: "thanhTien",
    labelFieldKey: "tenHang",
    carryInLabel: "Mang sang",
    carryOutLabel: "Cộng sang trang",
    columnMeta: {
      tenHang: { width: 72, wrapText: false },
      thanhTien: { width: 72, wrapText: false },
    },
  };
  const detailRows = Array.from({ length: 45 }, (_, i) => ({
    stt: i + 1,
    tenHang: `Hàng ${i + 1}`,
    thanhTien: "1.000",
  }));
  const expanded = expandDetailRowsWithCarryRows(detailRows, printProfile, columns);
  assert.ok(expanded.length > 45);
  assert.equal(expanded.filter((row) => row.__carryRow === "carry-out").length, 1);
});

test("buildSheetPrintOutput returns contiguous dense grid with carry rows", () => {
  const output = buildSheetPrintOutput({
    detailRows: Array.from({ length: 50 }, (_, i) => ({
      stt: i + 1,
      tenHang: `Hàng ${i + 1}`,
      thanhTien: "1.000",
    })),
    columns: ["stt", "tenHang", "thanhTien"],
    tableCfg: {
      startRow: 8,
      rowsPerPage: 40,
      rowHeightPt: 18,
    },
    printSheets: {
      columnMeta: {
        tenHang: { width: 72, wrapText: false },
        thanhTien: { width: 72, wrapText: false },
      },
    },
  });
  assert.equal(output.mode, "contiguous");
  assert.equal(output.values.length, 52);
  assert.equal(output.values[0][0], 1);
  assert.equal(output.values[38][0], 39);
  assert.equal(output.values[39][1], "Cộng sang trang");
  assert.equal(output.values[40][1], "Mang sang");
  assert.equal(output.values[41][0], 40);
  assert.equal(output.rowLineUnits.length, 52);
});

test("buildChungTuSheetPrintRowsWithWrap outputs sheet cell matrix", () => {
  const result = buildChungTuSheetPrintRowsWithWrap({
    detailRows: [{ stt: 1, tenHang: "Gạo", thanhTien: "10.000" }],
    columns: ["stt", "tenHang", "thanhTien"],
    printProfile: {
      enabled: true,
      rowsPerPage: 40,
      rowHeightPt: 18,
      amountFieldKey: "thanhTien",
      labelFieldKey: "tenHang",
      carryInLabel: "Mang sang",
      carryOutLabel: "Cộng sang trang",
      columnMeta: {},
    },
  });
  assert.deepEqual(result.values, [[1, "Gạo", "10.000"]]);
  assert.deepEqual(result.rowLineUnits, [1]);
});

test("buildPerRowHeightUpdateRequests scales height by wrap line units", () => {
  const requests = buildPerRowHeightUpdateRequests({
    sheetId: 0,
    startRow0: 8,
    rowLineUnits: [1, 3, 1],
    rowHeightPt: 18,
  });
  assert.equal(requests.length, 3);
  assert.equal(requests[0].updateDimensionProperties.range.startIndex, 8);
  assert.equal(requests[1].updateDimensionProperties.range.startIndex, 9);
  assert.ok(
    requests[1].updateDimensionProperties.properties.pixelSize >
      requests[0].updateDimensionProperties.properties.pixelSize,
  );
});
