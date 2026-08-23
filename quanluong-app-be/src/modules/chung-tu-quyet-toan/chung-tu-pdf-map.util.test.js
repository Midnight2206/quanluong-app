import assert from "node:assert/strict";
import {
  camelToSnake,
  pickMappedFields,
  mapDetailRows,
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

assert.deepEqual(
  mapDetailRows(
    [{ stt: "1", tenHang: "Gạo", thanhTien: "10.000", ignoreMe: true }],
    ["stt", "ten_hang", "thanh_tien"],
  ),
  [{ stt: "1", ten_hang: "Gạo", thanh_tien: "10.000" }],
);

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
