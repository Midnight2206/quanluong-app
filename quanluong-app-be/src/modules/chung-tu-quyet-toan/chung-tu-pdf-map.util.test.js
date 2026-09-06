import assert from "node:assert/strict";
import test from "node:test";
import { CHUNG_TU_CATEGORY_KEYS } from "./chung-tu-category.constants.js";
import {
  camelToSnake,
  pickMappedFields,
  mapDetailRows,
  mapDetailRowsForTemplate,
  buildDocumentServicePayload,
} from "./chung-tu-pdf-map.util.js";

assert.equal(camelToSnake("thanhTien"), "thanh_tien");
assert.equal(camelToSnake("soChungTu"), "so_chung_tu");

assert.deepEqual(
  pickMappedFields(
    { thanhTien: "1.000", soChungTu: "A1", extra: "x" },
    ["thanh_tien", "so_chung_tu"],
  ),
  { thanh_tien: "1.000", so_chung_tu: "A1" },
);

test("pickMappedFields applies provided field labels", () => {
  assert.deepEqual(
    pickMappedFields(
      { soChungTu: "062615", so: "062615", soPhieu: "062615" },
      ["so_chung_tu", "so", "so_phieu"],
      {
        fieldLabels: {
          soChungTu: "Số: ",
          so: "Số: ",
          soPhieu: "Số: ",
        },
      },
    ),
    {
      so_chung_tu: "Số: 062615",
      so: "Số: 062615",
      so_phieu: "Số: 062615",
    },
  );
});

test("pickMappedFields applies soChungTu label to so/soPhieu aliases", () => {
  assert.deepEqual(
    pickMappedFields(
      { soChungTu: "062615", so: "062615", soPhieu: "062615" },
      ["so_chung_tu", "so", "so_phieu", "FIELD_so"],
      { fieldLabels: { soChungTu: "Số: " } },
    ),
    {
      so_chung_tu: "Số: 062615",
      so: "Số: 062615",
      so_phieu: "Số: 062615",
      FIELD_so: "Số: 062615",
    },
  );
});

test("pickMappedFields leaves empty soChungTu empty", () => {
  assert.deepEqual(pickMappedFields({ soChungTu: "  " }, ["so_chung_tu"]), {
    so_chung_tu: "",
  });
});

test("pickMappedFields leaves raw values when label missing", () => {
  assert.deepEqual(
    pickMappedFields(
      { tongTienBangChu: "Một triệu", soChungTu: "CT-01" },
      ["tong_tien_bang_chu", "so_chung_tu"],
    ),
    {
      tong_tien_bang_chu: "Một triệu",
      so_chung_tu: "CT-01",
    },
  );
});

test("pickMappedFields resolves scalar legacy aliases with provided labels", () => {
  assert.deepEqual(
    pickMappedFields(
      { tongTienBangChu: "Một triệu", ngayThangNam: "ngày 15 tháng 8 năm 2026" },
      ["tong_tien_bang_chu", "ngay_thang_nam"],
      {
        fieldLabels: {
          tongTienBangChu: "Tổng số tiền (Viết bằng chữ): ",
        },
      },
    ),
    {
      tong_tien_bang_chu: "Tổng số tiền (Viết bằng chữ): Một triệu",
      ngay_thang_nam: "ngày 15 tháng 8 năm 2026",
    },
  );
});

test("pickMappedFields avoids double prefix when label already present", () => {
  assert.deepEqual(
    pickMappedFields(
      { soChungTu: "Số: CT-01" },
      ["so_chung_tu"],
      { fieldLabels: { soChungTu: "Số: " } },
    ),
    { so_chung_tu: "Số: CT-01" },
  );
});

test("pickMappedFields accepts raw template key lookup for labels", () => {
  assert.deepEqual(
    pickMappedFields(
      { soChungTu: "CT-01" },
      ["so_chung_tu"],
      { fieldLabels: { so_chung_tu: "Số: " } },
    ),
    { so_chung_tu: "Số: CT-01" },
  );
});

test("pickMappedFields maps PNK người giao scalar fields", () => {
  assert.deepEqual(
    pickMappedFields(
      {
        nguoiGiaoHang: "Nguyễn Văn A",
        diaChi: "Tài vụ",
        lyDoNhapKho: "Nhập hàng bổ sung",
        nhapTaiKho: "Kho tổng",
      },
      ["FIELD_nguoi_giao_hang", "FIELD_dia_chi", "FIELD_ly_do_nhap_kho", "FIELD_nhap_tai_kho"],
      { categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO },
    ),
    {
      FIELD_nguoi_giao_hang: "Nguyễn Văn A",
      FIELD_dia_chi: "Tài vụ",
      FIELD_ly_do_nhap_kho: "Nhập hàng bổ sung",
      FIELD_nhap_tai_kho: "Kho tổng",
    },
  );
});

assert.deepEqual(
  mapDetailRows(
    [{ stt: "1", tenHang: "Gạo", thanhTien: "10.000", ignoreMe: true }],
    ["stt", "ten_hang", "thanh_tien"],
  ),
  [{ stt: "1", ten_hang: "Gạo", thanh_tien: "10.000" }],
);

test("mapDetailRowsForTemplate writes ten_mat_hang column", () => {
  const rows = mapDetailRowsForTemplate(
    [{ stt: 1, tenHang: "Gạo" }],
    ["stt", "ten_mat_hang"],
  );
  assert.equal(rows[0].ten_mat_hang, "Gạo");
});

test("mapDetailRowsForTemplate maps tt and long seller column keys", () => {
  const rows = mapDetailRowsForTemplate(
    [{ stt: 2, tenHang: "Gạo", nguoiBan: "HTX An Phú" }],
    ["tt", "ten_nguoi_ban_hoac_dia_chi_mua_hang"],
  );
  assert.deepEqual(rows[0], {
    tt: "2",
    ten_nguoi_ban_hoac_dia_chi_mua_hang: "HTX An Phú",
  });
});

const payload = buildDocumentServicePayload({
  context: { donVi: "Bếp A", detailRows: [{ stt: "1", tenHang: "Gạo" }] },
  fieldKeys: ["don_vi"],
  columnKeys: ["stt", "ten_hang"],
  signatures: { nguoi_lap: "A" },
  signatureDates: { nguoi_lap: "ngày 1" },
});
assert.deepEqual(payload.fields, { don_vi: "Bếp A" });
assert.deepEqual(payload.rows, [{ stt: "1", ten_hang: "Gạo" }]);
assert.deepEqual(payload.signatures, { nguoi_lap: "A" });
assert.deepEqual(payload.signature_dates, { nguoi_lap: "ngày 1" });

test("buildDocumentServicePayload maps ten_mat_hang template column", () => {
  const p = buildDocumentServicePayload({
    context: { detailRows: [{ stt: "1", tenHang: "Gạo" }] },
    fieldKeys: [],
    columnKeys: ["stt", "ten_mat_hang"],
  });
  assert.deepEqual(p.rows, [{ stt: "1", ten_mat_hang: "Gạo" }]);
});

test("buildDocumentServicePayload forwards categoryKey to scalar mapping", () => {
  const p = buildDocumentServicePayload({
    categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
    context: { diaChi: "Tài vụ" },
    fieldKeys: ["FIELD_dia_chi"],
    columnKeys: [],
  });
  assert.deepEqual(p.fields, { FIELD_dia_chi: "Tài vụ" });
});

test("buildDocumentServicePayload forwards fieldLabels into scalar formatting", () => {
  const p = buildDocumentServicePayload({
    context: { soChungTu: "CT-01" },
    fieldKeys: ["so_chung_tu"],
    columnKeys: [],
    fieldLabels: { soChungTu: "Số: " },
  });
  assert.deepEqual(p.fields, { so_chung_tu: "Số: CT-01" });
});
