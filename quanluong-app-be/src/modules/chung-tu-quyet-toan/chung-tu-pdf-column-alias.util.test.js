import test from "node:test";
import assert from "node:assert/strict";
import { resolveColumnFieldKey, resolveScalarFieldKey } from "./chung-tu-pdf-column-alias.util.js";

test("resolveColumnFieldKey maps ten_mat_hang to tenHang", () => {
  assert.equal(resolveColumnFieldKey("ten_mat_hang"), "tenHang");
});

test("resolveColumnFieldKey maps ten_hang to tenHang", () => {
  assert.equal(resolveColumnFieldKey("ten_hang"), "tenHang");
});

test("resolveColumnFieldKey maps Excel TT slug and seller slug", () => {
  assert.equal(resolveColumnFieldKey("tt"), "stt");
  assert.equal(resolveColumnFieldKey("so_tt"), "stt");
  assert.equal(
    resolveColumnFieldKey("ten_nguoi_ban_hoac_dia_chi_mua_hang"),
    "nguoiBan",
  );
});

test("resolveScalarFieldKey maps tong_tien_bang_chu to tongTienBangChu", () => {
  assert.equal(resolveScalarFieldKey("tong_tien_bang_chu"), "tongTienBangChu");
});

test("resolveScalarFieldKey maps ngay_thang_nam to ngayThangNam", () => {
  assert.equal(resolveScalarFieldKey("ngay_thang_nam"), "ngayThangNam");
});

test("resolveScalarFieldKey maps tong_tien to tongTien", () => {
  assert.equal(resolveScalarFieldKey("tong_tien"), "tongTien");
});

test("resolveScalarFieldKey maps ho_ten_nguoi_mua aliases to hoTenNguoiMua", () => {
  assert.equal(resolveScalarFieldKey("FIELD_ho_ten_nguoi_mua"), "hoTenNguoiMua");
  assert.equal(resolveScalarFieldKey("FIELD_nguoi_mua"), "hoTenNguoiMua");
  assert.equal(resolveScalarFieldKey("ho_ten_nguoi_mua"), "hoTenNguoiMua");
});

test("resolveScalarFieldKey maps can_cu_pnk to canCuPnk only", () => {
  assert.equal(resolveScalarFieldKey("NL_FIELD_can_cu_pnk"), "canCuPnk");
  assert.equal(resolveScalarFieldKey("can_cu_pnk"), "canCuPnk");
  assert.equal(resolveScalarFieldKey("canCuPnk"), "canCuPnk");
  assert.equal(resolveScalarFieldKey("FIELD_can_cu_bkmh"), "");
});

test("resolveScalarFieldKey maps PNK scalar aliases", () => {
  assert.equal(resolveScalarFieldKey("FIELD_nguoi_giao_hang"), "nguoiGiaoHang");
  assert.equal(resolveScalarFieldKey("nguoi_giao_hang"), "nguoiGiaoHang");
  assert.equal(resolveScalarFieldKey("FIELD_ly_do_nhap_kho"), "lyDoNhapKho");
  assert.equal(resolveScalarFieldKey("ly_do_nhap_kho"), "lyDoNhapKho");
  assert.equal(resolveScalarFieldKey("FIELD_nhap_tai_kho"), "nhapTaiKho");
  assert.equal(resolveScalarFieldKey("nhap_tai_kho"), "nhapTaiKho");
});

test("resolveScalarFieldKey maps PNK dia_chi to diaChi", () => {
  assert.equal(
    resolveScalarFieldKey("FIELD_dia_chi", { categoryKey: "phieu-nhap-kho" }),
    "diaChi",
  );
  assert.equal(resolveScalarFieldKey("diaChi", { categoryKey: "phieu-nhap-kho" }), "diaChi");
});

test("resolveScalarFieldKey maps so/soPhieu aliases to soChungTu", () => {
  assert.equal(resolveScalarFieldKey("so"), "soChungTu");
  assert.equal(resolveScalarFieldKey("so_phieu"), "soChungTu");
  assert.equal(resolveScalarFieldKey("soPhieu"), "soChungTu");
  assert.equal(resolveScalarFieldKey("FIELD_so"), "soChungTu");
});
