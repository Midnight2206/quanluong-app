import test from "node:test";
import assert from "node:assert/strict";

import { buildChungTuPrintPdfBuffer } from "./chung-tu-print-pdf.service.js";
import { CHUNG_TU_CATEGORY_KEYS } from "./chung-tu-category.constants.js";

test("buildChungTuPrintPdfBuffer returns a PDF buffer for BKMH context", async () => {
  const buffer = await buildChungTuPrintPdfBuffer({
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    context: {
      donViCapTren: "Sư đoàn 372",
      donViSo: "Phòng Hậu cần",
      boPhan: "Bếp ăn",
      ngayThangNam: "Ngày 01 tháng 06 năm 2026",
      so: "01",
      quyenSo: "0626",
      tongTien: "60.000",
      tongTienBangChu: "Sáu mươi nghìn đồng",
      signerNguoiMua: "Nguyễn Văn A",
      signerPhuTrachBoPhan: "Trần Văn B",
      signerTaiChinh: "Lê Văn C",
      signerApprover: "Phạm Văn D",
      detailRows: [
        { stt: 1, tenHang: "Gạo tẻ", dvt: "kg", nguoiBan: "Nhà cung cấp A", soLuong: 10, donGia: "3.000", thanhTien: "30.000" },
        { stt: 2, tenHang: "Rau xanh", dvt: "kg", nguoiBan: "Nhà cung cấp B", soLuong: 5, donGia: "6.000", thanhTien: "30.000" },
      ],
    },
    fillRules: {
      version: 2,
      sheets: {
        detailTable: {
          columns: ["stt", "tenHang", "dvt", "nguoiBan", "soLuong", "donGia", "thanhTien"],
        },
      },
      print: {
        pdf: {
          table: {
            headerLabels: ["STT", "Tên hàng", "ĐVT", "Người bán", "Số lượng", "Đơn giá", "Thành tiền"],
          },
        },
      },
    },
  });

  assert.equal(Buffer.isBuffer(buffer), true);
  assert.equal(buffer.subarray(0, 4).toString("utf8"), "%PDF");
});
