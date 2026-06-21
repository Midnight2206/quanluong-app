import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCopyTemplateRowFormatRequest,
  buildDeleteExtraDataRowsRequest,
  buildDetailTableFillPlan,
  buildInsertDataRowsRequestFromPlan,
  buildPerRowHeightUpdateRequests,
  buildTotalRowAmountCellA1,
  estimateRowUnits,
  normalizeSheetTableConfig,
  resolveOverflowFormatTarget,
  resolveNamedRangeTargetCell,
  resolveTotalRowIndex,
} from "./chung-tu-sheet-print-pagination.js";

test("normalizeSheetTableConfig defaults start/template/total rows", () => {
  const cfg = normalizeSheetTableConfig({ startRow: 8 }, {});
  assert.equal(cfg.startRow, 8);
  assert.equal(cfg.templateRow, 8);
  assert.equal(cfg.totalTemplateRow, 9);
  assert.equal(cfg.rowHeightPt, 18);
});

test("resolveTotalRowIndex keeps template total row for single data line", () => {
  const cfg = normalizeSheetTableConfig({ startRow: 8, totalTemplateRow: 9 }, {});
  assert.equal(resolveTotalRowIndex(cfg, 1), 9);
});

test("resolveTotalRowIndex shifts total row only when data exceeds template slots", () => {
  const cfg = normalizeSheetTableConfig({ startRow: 8, totalTemplateRow: 9 }, {});
  assert.equal(resolveTotalRowIndex(cfg, 4), 12);
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

test("buildDetailTableFillPlan uses total template row and column mappings", () => {
  const plan = buildDetailTableFillPlan({
    detailRows: [
      { stt: 1, tenHang: "Gạo", thanhTien: "10.000" },
      { stt: 2, tenHang: "Thịt", thanhTien: "20.000" },
    ],
    columns: ["stt", "tenHang", "thanhTien"],
    tableCfg: {
      startRow: 8,
      startCol: 0,
      totalTemplateRow: 9,
      columnMappings: [
        { col: 0, label: "STT", fieldKey: "stt" },
        { col: 1, label: "Tên hàng", fieldKey: "tenHang" },
        { col: 6, label: "Thành tiền", fieldKey: "thanhTien" },
      ],
    },
    context: { tongTien: "30.000", tongTienSo: 30000 },
    columnMeta: {
      tenHang: { width: 72, wrapText: false },
      thanhTien: { width: 72, wrapText: false },
    },
  });
  assert.equal(plan.dataRowCount, 2);
  assert.equal(plan.totalRow0, 10);
  assert.equal(plan.writeStartCol, 0);
  assert.equal(plan.writeColCount, 7);
  assert.deepEqual(plan.values[0][1], "Gạo");
  assert.equal(plan.totalAmount, "30.000");
});

test("buildTotalRowAmountCellA1 targets mapped amount column", () => {
  const range = buildTotalRowAmountCellA1({
    sheetName: "01",
    totalRow0: 10,
    startCol0: 0,
    columns: ["stt", "tenHang", "thanhTien"],
    amountFieldKey: "thanhTien",
    columnMappings: [
      { col: 0, fieldKey: "stt" },
      { col: 1, fieldKey: "tenHang" },
      { col: 6, fieldKey: "thanhTien" },
    ],
  });
  assert.equal(range, "'01'!G11");
});

test("buildInsertDataRowsRequestFromPlan inserts before shifted total row", () => {
  const plan = buildDetailTableFillPlan({
    detailRows: [
      { stt: 1, tenHang: "A", thanhTien: "1" },
      { stt: 2, tenHang: "B", thanhTien: "2" },
      { stt: 3, tenHang: "C", thanhTien: "3" },
      { stt: 4, tenHang: "D", thanhTien: "4" },
    ],
    columns: ["stt", "tenHang", "thanhTien"],
    tableCfg: { startRow: 8, totalTemplateRow: 9 },
    context: {},
    columnMeta: {},
  });
  const req = buildInsertDataRowsRequestFromPlan({
    sheetId: 1,
    plan,
    previousDataRowCount: 1,
  });
  assert.equal(req.insertDimension.range.startIndex, 9);
  assert.equal(req.insertDimension.range.endIndex, 12);
  assert.equal(
    buildInsertDataRowsRequestFromPlan({
      sheetId: 1,
      plan,
      previousDataRowCount: 4,
    }),
    null,
  );
});

test("buildInsertDataRowsRequestFromPlan skips insert when template still has data slots", () => {
  const plan = buildDetailTableFillPlan({
    detailRows: [
      { stt: 1, tenHang: "A", thanhTien: "1" },
      { stt: 2, tenHang: "B", thanhTien: "2" },
    ],
    columns: ["stt", "tenHang", "thanhTien"],
    tableCfg: { startRow: 8, totalTemplateRow: 13 },
    context: {},
    columnMeta: {},
  });
  assert.equal(plan.totalRow0, 13);
  assert.equal(
    buildInsertDataRowsRequestFromPlan({
      sheetId: 1,
      plan,
      previousDataRowCount: 1,
    }),
    null,
  );
});

test("buildDeleteExtraDataRowsRequest removes only overflow rows before total", () => {
  const plan = buildDetailTableFillPlan({
    detailRows: [
      { stt: 1, tenHang: "A", thanhTien: "1" },
      { stt: 2, tenHang: "B", thanhTien: "2" },
    ],
    columns: ["stt", "tenHang", "thanhTien"],
    tableCfg: { startRow: 8, totalTemplateRow: 9 },
    context: {},
    columnMeta: {},
  });
  const req = buildDeleteExtraDataRowsRequest({
    sheetId: 1,
    plan,
    previousDataRowCount: 5,
  });
  assert.equal(req.deleteDimension.range.startIndex, 10);
  assert.equal(req.deleteDimension.range.endIndex, 13);
});

test("buildDeleteExtraDataRowsRequest skips delete when shrinking within template slots", () => {
  const plan = buildDetailTableFillPlan({
    detailRows: [
      { stt: 1, tenHang: "A", thanhTien: "1" },
      { stt: 2, tenHang: "B", thanhTien: "2" },
    ],
    columns: ["stt", "tenHang", "thanhTien"],
    tableCfg: { startRow: 8, totalTemplateRow: 13 },
    context: {},
    columnMeta: {},
  });
  assert.equal(
    buildDeleteExtraDataRowsRequest({
      sheetId: 1,
      plan,
      previousDataRowCount: 4,
    }),
    null,
  );
});

test("buildPerRowHeightUpdateRequests scales height by wrap line units", () => {
  const requests = buildPerRowHeightUpdateRequests({
    sheetId: 0,
    startRow0: 8,
    rowLineUnits: [1, 3, 1],
    rowHeightPt: 18,
  });
  assert.equal(requests.length, 3);
  assert.ok(
    requests[1].updateDimensionProperties.properties.pixelSize >
      requests[0].updateDimensionProperties.properties.pixelSize,
  );
});

test("buildCopyTemplateRowFormatRequest only formats overflow rows beyond template slots", () => {
  const req = buildCopyTemplateRowFormatRequest({
    sheetId: 1,
    templateRow0: 13,
    startRow0: 13,
    dataRowCount: 5,
    startCol0: 0,
    colCount: 10,
    totalTemplateRow0: 14,
  });
  assert.ok(req?.copyPaste);
  assert.equal(req.copyPaste.source.startRowIndex, 13);
  assert.equal(req.copyPaste.destination.startRowIndex, 14);
  assert.equal(req.copyPaste.destination.endRowIndex, 18);
  assert.equal(
    buildCopyTemplateRowFormatRequest({
      sheetId: 1,
      templateRow0: 13,
      startRow0: 13,
      dataRowCount: 1,
      startCol0: 0,
      colCount: 10,
      totalTemplateRow0: 14,
    }),
    null,
  );
});

test("resolveOverflowFormatTarget matches insert row math", () => {
  const plan = buildDetailTableFillPlan({
    detailRows: [
      { stt: 1, tenHang: "A", thanhTien: "1" },
      { stt: 2, tenHang: "B", thanhTien: "2" },
      { stt: 3, tenHang: "C", thanhTien: "3" },
      { stt: 4, tenHang: "D", thanhTien: "4" },
    ],
    columns: ["stt", "tenHang", "thanhTien"],
    tableCfg: { startRow: 13, totalTemplateRow: 14 },
    context: {},
    columnMeta: {},
  });
  const target = resolveOverflowFormatTarget(plan);
  assert.equal(target.dataSlots, 1);
  assert.equal(target.overflowCount, 3);
  assert.equal(target.destStartRow, 14);
});

test("resolveNamedRangeTargetCell shifts footer named range with total row", () => {
  const detailTable = { totalTemplateRow: 14, sheetName: "NHẬP" };
  const layoutPlan = { totalRow0: 113 };
  const target = resolveNamedRangeTargetCell({
    nrRule: { templateRowIndex: 14, templateColIndex: 0, sheetName: "NHẬP" },
    bounds: { sheetTitle: "NHẬP", startRow: 14, startCol: 0 },
    detailTable,
    layoutPlan,
  });
  assert.equal(target.startRow, 113);
  assert.equal(target.startCol, 0);
});

test("resolveNamedRangeTargetCell keeps header named range at template row", () => {
  const target = resolveNamedRangeTargetCell({
    nrRule: { templateRowIndex: 5, templateColIndex: 2 },
    bounds: { sheetTitle: "NHẬP", startRow: 5, startCol: 2 },
    detailTable: { totalTemplateRow: 14 },
    layoutPlan: { totalRow0: 113 },
  });
  assert.equal(target.startRow, 5);
});
