import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExportContextJson,
  buildExportSummaryFromContext,
  sumFolderTongTien,
} from "./chung-tu-pdf-export-summary.util.js";

test("buildExportSummaryFromContext maps known context keys", () => {
  const summary = buildExportSummaryFromContext({
    soChungTu: "062601",
    periodDate: "2026-06-15",
    ngayThangNam: "ngày 15 tháng 6 năm 2026",
    tongTien: 1500000,
    recipientUnitName: "Đại đội 1",
  });
  assert.deepEqual(summary, {
    soChungTu: "062601",
    periodDate: "2026-06-15",
    ngayThangNam: "ngày 15 tháng 6 năm 2026",
    tongTien: 1500000,
    recipientUnitName: "Đại đội 1",
  });
});

test("buildExportSummaryFromContext returns null when empty", () => {
  assert.equal(buildExportSummaryFromContext(null), null);
  assert.equal(buildExportSummaryFromContext({}), null);
});

test("buildExportSummaryFromContext sums detailRows thanhTien when tongTien missing", () => {
  const summary = buildExportSummaryFromContext({
    soChungTu: "1",
    periodDate: "2026-06-01",
    detailRows: [{ thanhTien: 1000 }, { thanhTien: "2.000" }, { thanhTien: null }],
  });
  assert.equal(summary.soChungTu, "1");
  assert.equal(summary.tongTien, 3000);
});

test("sumFolderTongTien sums numeric tongTien only", () => {
  assert.equal(sumFolderTongTien([{ tongTien: 1 }, { tongTien: 2 }, {}]), 3);
  assert.equal(sumFolderTongTien([{ soChungTu: "x" }]), null);
});

test("buildExportContextJson keeps allocated numbers and detailRows", () => {
  const json = buildExportContextJson({
    sheetKey: "unit:5",
    quyenSo: "0626",
    soChungTu: "0001",
    periodDate: "2026-06-30",
    detailRows: [{ stt: 1, soLuong: 2 }],
    sheetContexts: [{ nested: true }],
    donVi: "Kho A",
  });
  assert.equal(json.sheetKey, "unit:5");
  assert.equal(json.soChungTu, "0001");
  assert.equal(json.quyenSo, "0626");
  assert.deepEqual(json.detailRows, [{ stt: 1, soLuong: 2 }]);
  assert.equal(json.donVi, "Kho A");
  assert.equal(json.sheetContexts, undefined);
});
