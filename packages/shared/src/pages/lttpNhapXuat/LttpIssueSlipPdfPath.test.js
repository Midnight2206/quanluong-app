import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lichSuSource = readFileSync(new URL("./LttpLichSuXuatTab.jsx", import.meta.url), "utf8");
const phieuSource = readFileSync(new URL("./LttpPhieuXuatTab.jsx", import.meta.url), "utf8");
const pdfOpenSource = readFileSync(new URL("./lttpIssueSlipPdfOpen.js", import.meta.url), "utf8");

test("Lịch sử xuất opens PDF via document-service print-pdf helper", () => {
  assert.match(lichSuSource, /openLttpIssueSlipPdfInTab/);
  assert.match(lichSuSource, /openLttpIssueSlipsMergedPdfInTab/);
  assert.match(pdfOpenSource, /\/lttp\/issue-slips\/\$\{id\}\/print-pdf/);
  assert.match(pdfOpenSource, /\/lttp\/issue-slips\/print-pdfs/);
  assert.doesNotMatch(lichSuSource, /LttpIssueSlipPrintHost|window\.print\(/);
});

test("Phiếu xuất opens PDF after save and exposes Xem PDF in edit mode", () => {
  assert.match(phieuSource, /openLttpIssueSlipPdfInTab/);
  assert.match(phieuSource, /openSavedSlipPdf/);
  assert.match(phieuSource, /Xem PDF/);
  assert.match(phieuSource, /lttp-phieu-xuat/);
  assert.doesNotMatch(phieuSource, /LttpIssueSlipPrintDocument|window\.print\(/);
  assert.doesNotMatch(phieuSource, /FONT_CHOICES|marginTopCm|printFontId|Lề trên/);
});
