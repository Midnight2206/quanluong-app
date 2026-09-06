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
