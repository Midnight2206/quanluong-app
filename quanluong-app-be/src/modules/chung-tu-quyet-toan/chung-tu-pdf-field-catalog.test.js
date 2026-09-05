import assert from "node:assert/strict";
import test from "node:test";
import { getChungTuPdfFieldCatalog } from "./chung-tu-pdf-field-catalog.js";

test("catalog includes FIELD_can_cu_bkmh → canCuBkmh", () => {
  const { scalarFields } = getChungTuPdfFieldCatalog();
  const row = scalarFields.find((f) => f.namedRange === "FIELD_can_cu_bkmh");
  assert.ok(row);
  assert.equal(row.fieldKey, "canCuBkmh");
  assert.match(String(row.label), /căn cứ|BKMH/i);
});

test("catalog includes PNK người giao scalar fields", () => {
  const { scalarFields } = getChungTuPdfFieldCatalog();
  const nguoiGiao = scalarFields.find((f) => f.namedRange === "FIELD_nguoi_giao_hang");
  const diaChi = scalarFields.find((f) => f.namedRange === "FIELD_dia_chi");
  const nhapTaiKho = scalarFields.find((f) => f.namedRange === "FIELD_nhap_tai_kho");

  assert.ok(nguoiGiao);
  assert.equal(nguoiGiao.fieldKey, "nguoiGiaoHang");
  assert.match(String(nguoiGiao.label), /người giao/i);

  assert.ok(diaChi);
  assert.equal(diaChi.fieldKey, "diaChi");
  assert.match(String(diaChi.label), /PNK|bộ phận/i);

  assert.ok(nhapTaiKho);
  assert.equal(nhapTaiKho.fieldKey, "nhapTaiKho");
  assert.match(String(nhapTaiKho.label), /nhập tại kho/i);
});
