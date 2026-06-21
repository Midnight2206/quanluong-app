import test from "node:test";
import assert from "node:assert/strict";

import {
  guessDetailFieldKeyFromLabel,
  resolveDetailColumnMappings,
} from "./chung-tu-detail-field-catalog.js";

test("guessDetailFieldKeyFromLabel maps Vietnamese headers", () => {
  assert.equal(guessDetailFieldKeyFromLabel("Tên hàng"), "tenHang");
  assert.equal(guessDetailFieldKeyFromLabel("Thực xuất"), "thucXuat");
  assert.equal(guessDetailFieldKeyFromLabel("Yêu cầu"), "yeuCau");
  assert.equal(guessDetailFieldKeyFromLabel("Thành tiền"), "thanhTien");
  assert.equal(guessDetailFieldKeyFromLabel("Thực nhập"), "thucNhap");
  assert.equal(guessDetailFieldKeyFromLabel("Số lượng yêu cầu"), "yeuCau");
});

test("resolveDetailColumnMappings prefers columnMappings over legacy columns", () => {
  const mappings = resolveDetailColumnMappings({
    startCol: 0,
    columns: ["stt", "tenHang"],
    columnMappings: [
      { col: 2, label: "Mã số", fieldKey: "maSo" },
      { col: 5, label: "Thành tiền", fieldKey: "thanhTien" },
    ],
  });
  assert.equal(mappings.length, 2);
  assert.equal(mappings[1].col, 5);
  assert.equal(mappings[1].fieldKey, "thanhTien");
});
