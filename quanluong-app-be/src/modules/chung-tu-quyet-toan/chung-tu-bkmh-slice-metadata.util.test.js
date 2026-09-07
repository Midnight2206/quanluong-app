import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBkmhSliceMetadata,
  buildBkmhSliceDetailRowsSnapshot,
  parseBkmhSliceDetailRowsJson,
  sumSliceTongTien,
} from "./chung-tu-bkmh-slice-metadata.util.js";

test("buildBkmhSliceMetadata prefers soChungTu and tongTienSo", () => {
  const meta = buildBkmhSliceMetadata({
    soChungTu: "062615",
    so: "ignored",
    ngayThangNam: "Ngày 01 tháng 06 năm 2026",
    periodDate: "2026-06-01",
    recipientUnitId: 5,
    recipientUnitName: "Tiểu đoàn 1",
    tongTienSo: 1500000,
    tongTien: "1.500.000",
  });
  assert.equal(meta.soChungTu, "062615");
  assert.equal(meta.ngayThangNam, "Ngày 01 tháng 06 năm 2026");
  assert.equal(meta.recipientUnitName, "Tiểu đoàn 1");
  assert.equal(meta.tongTien, 1500000);
  assert.equal(meta.periodDate, "2026-06-01");
});

test("sumSliceTongTien rolls up decimals", () => {
  assert.equal(
    sumSliceTongTien([
      { tongTien: 1000 },
      { tongTien: 2500.5 },
      { tongTien: null },
    ]),
    3500.5,
  );
});

test("buildBkmhSliceDetailRowsSnapshot keeps display fields and adds raw numerics", () => {
  const rows = buildBkmhSliceDetailRowsSnapshot({
    detailRows: [
      {
        stt: 1,
        tenHang: "Gạo",
        maSo: "G01",
        dvt: "Kg",
        soLuong: 2,
        donGia: "10.000",
        thanhTien: "20.000",
        commodityId: 7,
        quantity: 2,
        unitPrice: 10000,
        amount: 20000,
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tenHang, "Gạo");
  assert.equal(rows[0].commodityId, 7);
  assert.equal(rows[0].quantity, 2);
  assert.equal(rows[0].unitPrice, 10000);
  assert.equal(rows[0].amount, 20000);
});

test("buildBkmhSliceDetailRowsSnapshot derives raw from soLuong/donGia/thanhTien when raw missing", () => {
  const rows = buildBkmhSliceDetailRowsSnapshot({
    detailRows: [
      {
        stt: 1,
        tenHang: "Thịt",
        soLuong: 3,
        donGia: "50.000",
        thanhTien: "150.000",
      },
    ],
  });
  assert.equal(rows[0].quantity, 3);
  assert.equal(rows[0].unitPrice, 50000);
  assert.equal(rows[0].amount, 150000);
  assert.equal(rows[0].commodityId, null);
});

test("parseBkmhSliceDetailRowsJson returns [] for null/invalid", () => {
  assert.deepEqual(parseBkmhSliceDetailRowsJson(null), []);
  assert.deepEqual(parseBkmhSliceDetailRowsJson({}), []);
  assert.deepEqual(parseBkmhSliceDetailRowsJson([{ tenHang: "A" }]), [{ tenHang: "A" }]);
});
