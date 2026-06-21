import test from "node:test";
import assert from "node:assert/strict";

import {
  formatDerivedNamedRangeValue,
  resolveLegacyNamedRangeFieldKey,
} from "./chung-tu-named-range-display.js";

test("formatDerivedNamedRangeValue adds Vietnamese labels for single-cell ranges", () => {
  assert.equal(formatDerivedNamedRangeValue("quyenSo", "0626"), "Quyển số: 0626");
  assert.equal(formatDerivedNamedRangeValue("so", "062615"), "Số: 062615");
  assert.equal(
    formatDerivedNamedRangeValue("tongTienBangChu", "Sáu mươi nghìn đồng"),
    "Tổng số tiền (Viết bằng chữ): Sáu mươi nghìn đồng",
  );
  assert.equal(
    formatDerivedNamedRangeValue("ngayThangNam", "Ngày 01 tháng 06 năm 2026"),
    "Ngày 01 tháng 06 năm 2026",
  );
});

test("resolveLegacyNamedRangeFieldKey maps tongTienBanChu typo", () => {
  assert.equal(resolveLegacyNamedRangeFieldKey("tongtienbanchu"), "tongTienBangChu");
  assert.equal(resolveLegacyNamedRangeFieldKey("tongtienbangchu"), "tongTienBangChu");
});
