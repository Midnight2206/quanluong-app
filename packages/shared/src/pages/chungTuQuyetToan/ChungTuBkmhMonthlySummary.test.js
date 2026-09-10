import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
const pnkPanelUrl = new URL("./ChungTuPnkBatchSummaryPanel.jsx", import.meta.url);
const pnkPanelSource = existsSync(pnkPanelUrl) ? readFileSync(pnkPanelUrl, "utf8") : "";

test("category workspace keeps summary in the unified tab order and gates it with hasSummary", () => {
  assert.match(categoryWorkspaceSource, /config\?\.hasSummary/);
  assert.match(categoryWorkspaceSource, /id:\s*"export"[\s\S]*id:\s*"summary"[\s\S]*id:\s*"history"/);
  assert.match(categoryWorkspaceSource, /disabled:\s*!config\?\.hasSummary/);
  assert.match(categoryWorkspaceSource, /label:\s*"Tổng hợp"/);
  assert.match(categoryWorkspaceSource, /<ChungTuSummaryWorkspace categoryKey=\{categoryKey\} \/>/);
});

test("summary workspace lists monthly rows with unit filter and panel trigger", () => {
  assert.match(summaryWorkspaceSource, /useChungTuUnitScope/);
  assert.match(summaryWorkspaceSource, /useChungTuBkmhMonthlyListQuery/);
  assert.match(summaryWorkspaceSource, /useChungTuPdfExportBatchesQuery/);
  assert.match(summaryWorkspaceSource, /phieu-nhap-kho/);
  assert.match(summaryWorkspaceSource, /phieu-xuat-kho/);
  assert.match(summaryWorkspaceSource, /isFolderSummaryCategory/);
  assert.match(summaryWorkspaceSource, /Mở tổng hợp/);
  assert.match(summaryWorkspaceSource, /Tháng/);
  assert.match(summaryWorkspaceSource, /Chế độ gộp/);
  assert.match(summaryWorkspaceSource, /Số slice/);
  assert.match(summaryWorkspaceSource, /Tổng tiền tháng/);
  assert.match(summaryWorkspaceSource, /Cập nhật lúc/);
  assert.match(summaryWorkspaceSource, /ChungTuBkmhSliceSummaryPanel/);
  assert.match(summaryWorkspaceSource, /ChungTuPnkBatchSummaryPanel/);
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
  // Xem phải mở tab sync trước await (tránh popup blocker), giống In.
  assert.match(slicePanelSource, /handleViewSlice[\s\S]*?window\.open\("about:blank"/);
  assert.match(slicePanelSource, /openChungTuBkmhMonthlySliceFile\([\s\S]*?targetWindow:\s*tab/);
});

test("PNK summary panel exposes per-file metadata and merged zip actions", () => {
  assert.match(pnkPanelSource, /Số CT|soChungTu/);
  assert.match(pnkPanelSource, /ngayThangNam|periodDate/);
  assert.match(pnkPanelSource, /recipientUnitName/);
  assert.match(pnkPanelSource, /tongTien/);
  assert.match(
    pnkPanelSource,
    /openChungTuPdfBatchFile|downloadChungTuPdfBatchFile|openChungTuPdfBatchMergedPdf|downloadChungTuPdfBatchZip|downloadChungTuPdfBatchSummaryExcel/i,
  );
  assert.match(pnkPanelSource, /Xuất Excel/);
  assert.match(pnkPanelSource, /merged\.pdf|Tải zip|In tất cả/i);
});

test("export workspace routes monthly BKMH exports to monthly mutation", () => {
  assert.match(exportWorkspaceSource, /categoryKey === "bang-ke-mua-hang" && isMonthly/);
  assert.match(exportWorkspaceSource, /useCreateChungTuBkmhMonthlyExportMutation/);
  assert.match(exportWorkspaceSource, /const mutate = isBkmhMonthly \? createBkmhMonthlyExport : createPdfExportBatch/);
  assert.match(exportWorkspaceSource, /monthlyId:/);
  assert.match(exportWorkspaceSource, /sliceCount:/);
});

test("BKMH and PXK monthly export hide Ngày chứng từ but keep Tháng chứng từ", () => {
  assert.match(exportWorkspaceSource, /Tháng chứng từ/);
  assert.match(
    exportWorkspaceSource,
    /isPnkMonthly \?[\s\S]*: !isMonthly \?[\s\S]*Ngày chứng từ/,
  );
});

test("PNK monthly export uses date range and only allows by-day or full aggregation", () => {
  assert.match(exportWorkspaceSource, /categoryKey === "phieu-nhap-kho" && isMonthly/);
  assert.match(exportWorkspaceSource, /showAggregationPicker = isMonthly/);
  assert.match(
    exportWorkspaceSource,
    /effectiveAggregationMode = isPnkMonthly[\s\S]*CHUNG_TU_AGGREGATION_MODES\.FULL[\s\S]*CHUNG_TU_AGGREGATION_MODES\.BY_DAY/,
  );
  assert.match(exportWorkspaceSource, /const PNK_AGGREGATION_MODE_OPTIONS = Object\.freeze/);
  assert.match(exportWorkspaceSource, /label: "Theo ngày"/);
  assert.match(exportWorkspaceSource, /label: "Nhiều ngày"/);
  assert.match(exportWorkspaceSource, /1 PDF \/ buyer x ngày/);
  assert.match(exportWorkspaceSource, /1 PDF \/ buyer, gộp nhiều ngày/);
  assert.match(exportWorkspaceSource, /aggregationOptions = useMemo\([\s\S]*isPnkMonthly[\s\S]*PNK_AGGREGATION_MODE_OPTIONS/);
  assert.match(exportWorkspaceSource, /isPxkMonthly[\s\S]*PXK_AGGREGATION_MODE_OPTIONS/);
  assert.match(exportWorkspaceSource, /dateFrom/);
  assert.match(exportWorkspaceSource, /dateTo/);
});

test("monthly export validateWizardStep0 requires periodMonth only outside PNK and validates PNK range", () => {
  assert.match(exportWorkspaceSource, /Chọn tháng chứng từ\./);
  assert.match(
    exportWorkspaceSource,
    /isMonthly && !isPnkMonthly && !String\(periodMonth \?\? ""\)\.trim\(\)/,
  );
  assert.match(
    exportWorkspaceSource,
    /Chọn ngày bắt đầu\./,
  );
  assert.match(exportWorkspaceSource, /Chọn ngày kết thúc\./);
  assert.match(exportWorkspaceSource, /Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc\./);
});

test("PNK monthly export hides data-unit picker and omits unitIds from payload", () => {
  assert.match(
    exportWorkspaceSource,
    /isMonthly && !isPnkMonthly && unitsForDropdown\.length > 0/,
  );
  assert.match(
    exportWorkspaceSource,
    /if \(isPnkMonthly\) \{[\s\S]*dateFrom,[\s\S]*dateTo,[\s\S]*aggregationMode: effectiveAggregationMode/,
  );
  assert.match(
    exportWorkspaceSource,
    /isMonthly && !isPnkMonthly && selectedDataUnitIds\.length === 0/,
  );
  assert.match(
    exportWorkspaceSource,
    /isPnkMonthly\s*\?\s*Boolean\(dateFrom\) && Boolean\(dateTo\)\s*:\s*selectedDataUnitIds\.length > 0/,
  );
  assert.match(exportWorkspaceSource, /buyer từ BKMH/);
});

test("PXK monthly export uses by-unit and by-day aggregation only with by-unit default", () => {
  assert.match(exportWorkspaceSource, /categoryKey === "phieu-xuat-kho" && isMonthly/);
  assert.match(exportWorkspaceSource, /const PXK_AGGREGATION_MODE_OPTIONS = Object\.freeze/);
  assert.match(exportWorkspaceSource, /CHUNG_TU_AGGREGATION_MODES\.BY_UNIT/);
  assert.match(exportWorkspaceSource, /label: "Theo đơn vị"/);
  assert.match(exportWorkspaceSource, /label: "Theo ngày"/);
  const pxkOptionsMatch = exportWorkspaceSource.match(
    /const PXK_AGGREGATION_MODE_OPTIONS = Object\.freeze\([\s\S]*?\]\);/,
  );
  const pxkOptionsBlock = pxkOptionsMatch?.[0] ?? "";
  assert.ok(pxkOptionsBlock.length > 0, "PXK aggregation options block should exist");
  assert.doesNotMatch(pxkOptionsBlock, /FULL|"full"/);
  assert.match(
    exportWorkspaceSource,
    /aggregationOptions = useMemo\([\s\S]*isPxkMonthly[\s\S]*PXK_AGGREGATION_MODE_OPTIONS/,
  );
  assert.match(
    exportWorkspaceSource,
    /setAggregationMode\([\s\S]*CHUNG_TU_AGGREGATION_MODES\.BY_UNIT/,
  );
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
