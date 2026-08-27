import assert from "node:assert/strict";
import test from "node:test";
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
  { thanh_tien: "1.000", so_chung_tu: "Số: A1" },
);

test("pickMappedFields prefixes so_chung_tu with Số:", () => {
  assert.deepEqual(
    pickMappedFields(
      { soChungTu: "062615", so: "062615", soPhieu: "062615" },
      ["so_chung_tu", "so", "so_phieu"],
    ),
    {
      so_chung_tu: "Số: 062615",
      so: "Số: 062615",
      so_phieu: "Số: 062615",
    },
  );
});

test("pickMappedFields leaves empty soChungTu empty", () => {
  assert.deepEqual(pickMappedFields({ soChungTu: "  " }, ["so_chung_tu"]), {
    so_chung_tu: "",
  });
});

test("pickMappedFields resolves scalar legacy aliases", () => {
  assert.deepEqual(
    pickMappedFields(
      { tongTienBangChu: "Một triệu", ngayThangNam: "ngày 15 tháng 8 năm 2026" },
      ["tong_tien_bang_chu", "ngay_thang_nam"],
    ),
    {
      tong_tien_bang_chu: "Tổng số tiền (Viết bằng chữ): Một triệu",
      ngay_thang_nam: "ngày 15 tháng 8 năm 2026",
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
