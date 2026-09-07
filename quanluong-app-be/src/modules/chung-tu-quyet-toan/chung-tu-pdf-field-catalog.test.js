import assert from "node:assert/strict";
import test from "node:test";
import { getChungTuPdfFieldCatalog } from "./chung-tu-pdf-field-catalog.js";

test("catalog exposes descriptions and label alias for scalar rows", () => {
  const { scalarFields } = getChungTuPdfFieldCatalog();
  const row = scalarFields.find((f) => f.namedRange === "NL_FIELD_can_cu_pnk");
  assert.ok(row);
  assert.equal(row.fieldKey, "canCuPnk");
  assert.match(String(row.description), /căn cứ|BKMH/i);
  assert.equal(row.label, row.description);
  assert.equal(row.supportsLabel, false);
});

test("catalog marks supported template label fields", () => {
  const { scalarFields } = getChungTuPdfFieldCatalog();
  const supportedKeys = new Map(
    scalarFields.map((row) => [row.fieldKey, Boolean(row.supportsLabel)]),
  );
  assert.equal(supportedKeys.get("quyenSo"), true);
  assert.equal(supportedKeys.get("soChungTu"), true);
  assert.equal(supportedKeys.get("tongTienBangChu"), true);
  assert.equal(supportedKeys.get("hoTenNguoiMua"), true);
  assert.equal(supportedKeys.get("boPhan"), true);
  assert.equal(supportedKeys.get("nguoiGiaoHang"), true);
  assert.equal(supportedKeys.get("diaChi"), true);
  assert.equal(supportedKeys.get("lyDoNhapKho"), true);
  assert.equal(supportedKeys.get("canCuPnk"), false);
  assert.equal(supportedKeys.get("nhapTaiKho"), true);
  assert.equal(supportedKeys.get("tongTien"), false);
  assert.equal(supportedKeys.get("donVi"), false);
  assert.equal(supportedKeys.get("donViCapTren"), false);
  assert.equal(supportedKeys.get("ngayThangNam"), false);
});

test("catalog exposes shared unit/date fields as NL_FIELD only", () => {
  const { scalarFields } = getChungTuPdfFieldCatalog();
  const byRange = new Map(scalarFields.map((field) => [field.namedRange, field]));

  assert.equal(byRange.has("FIELD_don_vi"), false);
  assert.equal(byRange.has("FIELD_don_vi_cap_tren"), false);
  assert.equal(byRange.has("FIELD_ngay_thang_nam"), false);
  assert.equal(byRange.get("NL_FIELD_don_vi")?.fieldKey, "donVi");
  assert.equal(byRange.get("NL_FIELD_don_vi_cap_tren")?.fieldKey, "donViCapTren");
  assert.equal(byRange.get("NL_FIELD_ngay_thang_nam")?.fieldKey, "ngayThangNam");
});

test("catalog includes PNK người giao scalar descriptions", () => {
  const { scalarFields } = getChungTuPdfFieldCatalog();
  const nguoiGiao = scalarFields.find((f) => f.namedRange === "FIELD_nguoi_giao_hang");
  const diaChi = scalarFields.find((f) => f.namedRange === "FIELD_dia_chi");
  const lyDoNhapKho = scalarFields.find((f) => f.namedRange === "FIELD_ly_do_nhap_kho");
  const nhapTaiKho = scalarFields.find((f) => f.namedRange === "FIELD_nhap_tai_kho");

  assert.ok(nguoiGiao);
  assert.equal(nguoiGiao.fieldKey, "nguoiGiaoHang");
  assert.match(String(nguoiGiao.description), /người giao/i);

  assert.ok(diaChi);
  assert.equal(diaChi.fieldKey, "diaChi");
  assert.match(String(diaChi.description), /PNK|bộ phận/i);

  assert.ok(lyDoNhapKho);
  assert.equal(lyDoNhapKho.fieldKey, "lyDoNhapKho");
  assert.match(String(lyDoNhapKho.description), /lý do nhập kho/i);

  assert.ok(nhapTaiKho);
  assert.equal(nhapTaiKho.fieldKey, "nhapTaiKho");
  assert.match(String(nhapTaiKho.description), /nhập tại kho/i);
});

test("catalog includes PXK scalar descriptions", () => {
  const { scalarFields } = getChungTuPdfFieldCatalog();
  const nguoiNhan = scalarFields.find((f) => f.namedRange === "FIELD_nguoi_nhan");
  const diaChi = scalarFields.find((f) => f.namedRange === "FIELD_dia_chi");
  const lyDoXuatKho = scalarFields.find((f) => f.namedRange === "FIELD_ly_do_xuat_kho");
  const xuatTaiKho = scalarFields.find((f) => f.namedRange === "FIELD_xuat_tai_kho");
  const diaDiem = scalarFields.find((f) => f.namedRange === "FIELD_dia_diem");

  assert.ok(nguoiNhan);
  assert.equal(nguoiNhan.fieldKey, "nguoiNhan");
  assert.equal(nguoiNhan.supportsLabel, true);
  assert.match(String(nguoiNhan.description), /người nhận/i);

  assert.ok(diaChi);
  assert.equal(diaChi.fieldKey, "diaChi");
  assert.equal(diaChi.supportsLabel, true);

  assert.ok(lyDoXuatKho);
  assert.equal(lyDoXuatKho.fieldKey, "lyDoXuatKho");
  assert.equal(lyDoXuatKho.supportsLabel, true);
  assert.match(String(lyDoXuatKho.description), /lý do xuất kho/i);

  assert.ok(xuatTaiKho);
  assert.equal(xuatTaiKho.fieldKey, "xuatTaiKho");
  assert.equal(xuatTaiKho.supportsLabel, true);
  assert.match(String(xuatTaiKho.description), /xuất tại kho/i);

  assert.ok(diaDiem);
  assert.equal(diaDiem.fieldKey, "diaDiem");
  assert.equal(diaDiem.supportsLabel, true);
  assert.match(String(diaDiem.description), /địa điểm/i);
});
