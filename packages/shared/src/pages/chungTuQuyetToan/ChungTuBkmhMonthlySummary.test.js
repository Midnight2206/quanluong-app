import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const categoryWorkspaceSource = readFileSync(
  new URL("./ChungTuCategoryWorkspace.jsx", import.meta.url),
  "utf8",
);
const summaryWorkspaceSource = readFileSync(
  new URL("./ChungTuSummaryWorkspace.jsx", import.meta.url),
  "utf8",
);
const exportWorkspaceSource = readFileSync(
  new URL("./ChungTuExportWorkspace.jsx", import.meta.url),
  "utf8",
);
const historyWorkspaceSource = readFileSync(
  new URL("./ChungTuHistoryWorkspace.jsx", import.meta.url),
  "utf8",
);
const slicePanelSource = readFileSync(
  new URL("./ChungTuBkmhSliceSummaryPanel.jsx", import.meta.url),
  "utf8",
);

test("BKMH category workspace adds summary tab between export and history", () => {
  assert.match(categoryWorkspaceSource, /categoryKey === "bang-ke-mua-hang"/);
  assert.match(categoryWorkspaceSource, /id:\s*"export"[\s\S]*id:\s*"summary"[\s\S]*id:\s*"history"/);
  assert.match(categoryWorkspaceSource, /label:\s*"Tổng hợp"/);
  assert.match(categoryWorkspaceSource, /<ChungTuSummaryWorkspace categoryKey=\{categoryKey\} \/>/);
});

test("summary workspace lists monthly rows with unit filter and panel trigger", () => {
  assert.match(summaryWorkspaceSource, /useChungTuUnitScope/);
  assert.match(summaryWorkspaceSource, /useChungTuBkmhMonthlyListQuery/);
  assert.match(summaryWorkspaceSource, /Mở tổng hợp/);
  assert.match(summaryWorkspaceSource, /Tháng/);
  assert.match(summaryWorkspaceSource, /Chế độ gộp/);
  assert.match(summaryWorkspaceSource, /Số slice/);
  assert.match(summaryWorkspaceSource, /Tổng tiền tháng/);
  assert.match(summaryWorkspaceSource, /Cập nhật lúc/);
  assert.match(summaryWorkspaceSource, /ChungTuBkmhSliceSummaryPanel/);
});

test("slice summary panel loads detail data and exposes view download print actions", () => {
  assert.match(slicePanelSource, /useChungTuBkmhMonthlyDetailQuery/);
  assert.match(slicePanelSource, /openChungTuBkmhMonthlySliceFile/);
  assert.match(slicePanelSource, /downloadChungTuBkmhMonthlySliceFile/);
  assert.match(slicePanelSource, /downloadChungTuBkmhMonthlySummaryExcel/);
  assert.match(slicePanelSource, /Xuất Excel/);
  assert.match(slicePanelSource, /aggregationMode === "by-unit"/);
  assert.match(slicePanelSource, /Số CT/);
  assert.match(slicePanelSource, /Tên đơn vị/);
  assert.match(slicePanelSource, /Xem/);
  assert.match(slicePanelSource, /Tải/);
  assert.match(slicePanelSource, /In/);
});

test("export workspace routes monthly BKMH exports to monthly mutation", () => {
  assert.match(exportWorkspaceSource, /categoryKey === "bang-ke-mua-hang" && isMonthly/);
  assert.match(exportWorkspaceSource, /useCreateChungTuBkmhMonthlyExportMutation/);
  assert.match(exportWorkspaceSource, /const mutate = isBkmhMonthly \? createBkmhMonthlyExport : createPdfExportBatch/);
  assert.match(exportWorkspaceSource, /monthlyId:/);
  assert.match(exportWorkspaceSource, /sliceCount:/);
});

test("PNK monthly export hides aggregation picker and forces by-day", () => {
  assert.match(exportWorkspaceSource, /categoryKey === "phieu-nhap-kho" && isMonthly/);
  assert.match(exportWorkspaceSource, /showAggregationPicker = isMonthly && !isPnkMonthly/);
  assert.match(
    exportWorkspaceSource,
    /effectiveAggregationMode = isPnkMonthly\s*\?\s*CHUNG_TU_AGGREGATION_MODES\.BY_DAY\s*:\s*aggregationMode/,
  );
  assert.match(exportWorkspaceSource, /aggregationMode:\s*effectiveAggregationMode/);
  assert.match(exportWorkspaceSource, /\{showAggregationPicker \? \(/);
});

test("history workspace switches BKMH to monthly cards and summary panel", () => {
  assert.match(historyWorkspaceSource, /categoryKey === "bang-ke-mua-hang"/);
  assert.match(historyWorkspaceSource, /useChungTuBkmhMonthlyListQuery/);
  assert.match(historyWorkspaceSource, /downloadChungTuBkmhMonthlyZip/);
  assert.match(historyWorkspaceSource, /openChungTuBkmhMonthlyMergedPdf/);
  assert.match(historyWorkspaceSource, /useDeleteChungTuBkmhMonthlyMutation/);
  assert.match(historyWorkspaceSource, /Xem tổng hợp/);
  assert.match(historyWorkspaceSource, /ChungTuBkmhSliceSummaryPanel/);
  assert.match(historyWorkspaceSource, /Xóa batch/);
});
