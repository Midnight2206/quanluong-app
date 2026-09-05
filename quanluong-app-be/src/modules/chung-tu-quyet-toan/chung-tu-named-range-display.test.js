import test from "node:test";
import assert from "node:assert/strict";

import {
  formatDerivedNamedRangeValue,
  resolveLegacyNamedRangeFieldKey,
} from "./chung-tu-named-range-display.js";

test("formatDerivedNamedRangeValue returns raw value when label missing", () => {
  assert.equal(formatDerivedNamedRangeValue("quyenSo", "0626"), "0626");
  assert.equal(formatDerivedNamedRangeValue("so", "062615"), "062615");
  assert.equal(
    formatDerivedNamedRangeValue("tongTienBangChu", "Sáu mươi nghìn đồng"),
    "Sáu mươi nghìn đồng",
  );
  assert.equal(formatDerivedNamedRangeValue("ngayThangNam", "Ngày 01 tháng 06 năm 2026"), "Ngày 01 tháng 06 năm 2026");
  assert.equal(formatDerivedNamedRangeValue("hoTenNguoiMua", "Th/tá Nguyễn Văn A"), "Th/tá Nguyễn Văn A");
  assert.equal(formatDerivedNamedRangeValue("boPhan", "Tài vụ"), "Tài vụ");
  assert.equal(formatDerivedNamedRangeValue("hoTenNguoiMua", ""), "");
  assert.equal(formatDerivedNamedRangeValue("boPhan", ""), "");
});

test("formatDerivedNamedRangeValue prefixes value when label is provided", () => {
  assert.equal(
    formatDerivedNamedRangeValue("quyenSo", "0626", { label: "Quyển số: " }),
    "Quyển số: 0626",
  );
  assert.equal(
    formatDerivedNamedRangeValue("so", "062615", { label: "Số: " }),
    "Số: 062615",
  );
  assert.equal(
    formatDerivedNamedRangeValue("tongTienBangChu", "Sáu mươi nghìn đồng", {
      label: "Tổng số tiền (Viết bằng chữ): ",
    }),
    "Tổng số tiền (Viết bằng chữ): Sáu mươi nghìn đồng",
  );
  assert.equal(
    formatDerivedNamedRangeValue("hoTenNguoiMua", "Th/tá Nguyễn Văn A", {
      label: "- Họ và tên người mua: ",
    }),
    "- Họ và tên người mua: Th/tá Nguyễn Văn A",
  );
  assert.equal(
    formatDerivedNamedRangeValue("boPhan", "Tài vụ", { label: "- Bộ phận: " }),
    "- Bộ phận: Tài vụ",
  );
});

test("formatDerivedNamedRangeValue does not double a provided prefix", () => {
  assert.equal(
    formatDerivedNamedRangeValue("soChungTu", "Số: 062615", { label: "Số: " }),
    "Số: 062615",
  );
  assert.equal(formatDerivedNamedRangeValue("so", "Số: 1", { label: "Số: " }), "Số: 1");
  assert.equal(
    formatDerivedNamedRangeValue("hoTenNguoiMua", "- Họ và tên người mua: A", {
      label: "- Họ và tên người mua: ",
    }),
    "- Họ và tên người mua: A",
  );
  assert.equal(
    formatDerivedNamedRangeValue("boPhan", "- Bộ phận: Tài vụ", { label: "- Bộ phận: " }),
    "- Bộ phận: Tài vụ",
  );
});

test("formatDerivedNamedRangeValue ignores empty provided label", () => {
  assert.equal(formatDerivedNamedRangeValue("soChungTu", "062615", { label: "" }), "062615");
  assert.equal(formatDerivedNamedRangeValue("soChungTu", "062615", { label: "   " }), "062615");
});

test("resolveLegacyNamedRangeFieldKey maps tongTienBanChu typo", () => {
  assert.equal(resolveLegacyNamedRangeFieldKey("tongtienbanchu"), "tongTienBangChu");
  assert.equal(resolveLegacyNamedRangeFieldKey("tongtienbangchu"), "tongTienBangChu");
});
