import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dialogSource = readFileSync(
  new URL("./ChungTuReExportDialog.jsx", import.meta.url),
  "utf8",
);
const historySource = readFileSync(
  new URL("./ChungTuHistoryWorkspace.jsx", import.meta.url),
  "utf8",
);
const pdfApiSource = readFileSync(
  new URL("../../features/chung-tu-quyet-toan/api/chungTuPdfApi.js", import.meta.url),
  "utf8",
);
const bkmhApiSource = readFileSync(
  new URL("../../features/chung-tu-quyet-toan/api/chungTuBkmhMonthlyApi.js", import.meta.url),
  "utf8",
);

test("ChungTuReExportDialog offers refreshData checkbox default off", () => {
  assert.match(dialogSource, /Đọc lại dữ liệu/);
  assert.match(dialogSource, /refreshData/);
  assert.match(dialogSource, /useState\(false\)/);
  assert.match(dialogSource, /Xuất lại/);
});

test("history workspace wires Xuất lại", () => {
  assert.match(historySource, /Xuất lại/);
  assert.match(historySource, /ChungTuReExportDialog/);
  assert.match(historySource, /useReExportPdfBatchMutation|useReExportBkmhMonthlyMutation/);
});

test("API clients expose re-export endpoints", () => {
  assert.match(pdfApiSource, /re-export/);
  assert.match(pdfApiSource, /useReExportPdfBatchMutation/);
  assert.match(bkmhApiSource, /re-export/);
  assert.match(bkmhApiSource, /useReExportBkmhMonthlyMutation/);
});
