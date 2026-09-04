const CHUNG_TU_PDF_FIELD_CATALOG = Object.freeze({
  scalarFields: Object.freeze([
    {
      namedRange: "FIELD_ngay_thang_nam",
      fieldKey: "ngayThangNam",
      label: "Ngày DD tháng MM năm YYYY",
    },
    { namedRange: "FIELD_ngay", fieldKey: "ngay", label: "Ngày" },
    { namedRange: "FIELD_thang", fieldKey: "thang", label: "Tháng" },
    { namedRange: "FIELD_nam", fieldKey: "nam", label: "Năm" },
    {
      namedRange: "FIELD_tong_tien_bang_chu",
      fieldKey: "tongTienBangChu",
      label:
        "Tổng tiền bằng chữ — PDF engine tự vẽ dưới «Cộng»; Named Range không bắt buộc cho PDF (giữ cho Drive nếu có)",
    },
    { namedRange: "FIELD_tong_tien", fieldKey: "tongTien", label: "Tổng tiền (format VND)" },
    { namedRange: "FIELD_don_vi", fieldKey: "donVi", label: "Tên đơn vị" },
    {
      namedRange: "FIELD_don_vi_cap_tren",
      fieldKey: "donViCapTren",
      label: "Đơn vị cấp trên",
    },
    { namedRange: "FIELD_quyen_so", fieldKey: "quyenSo", label: "Quyển số" },
    { namedRange: "FIELD_so_chung_tu", fieldKey: "soChungTu", label: "Số chứng từ" },
    {
      namedRange: "FIELD_ho_ten_nguoi_mua",
      fieldKey: "hoTenNguoiMua",
      label: "Họ và tên người mua",
    },
    { namedRange: "FIELD_bo_phan", fieldKey: "boPhan", label: "Bộ phận" },
    {
      namedRange: "FIELD_can_cu_bkmh",
      fieldKey: "canCuBkmh",
      label:
        "Căn cứ theo BKMH (số, ngày…) — chủ yếu PNK; legacy Named Range `canCuBkmh` vẫn được nhận",
    },
    { namedRange: "FIELD_ghi_chu", fieldKey: "ghiChu", label: "Ghi chú" },
  ]),
  tableColumns: Object.freeze([
    { label: "STT", fieldKey: "stt" },
    { label: "Tên hàng", fieldKey: "tenHang" },
    { label: "Tên mặt hàng", fieldKey: "tenHang" },
    { label: "ĐVT", fieldKey: "dvt" },
    { label: "Số lượng", fieldKey: "soLuong" },
    { label: "Đơn giá", fieldKey: "donGia" },
    { label: "Thành tiền", fieldKey: "thanhTien" },
    { label: "Người bán", fieldKey: "nguoiBan" },
    { label: "Ghi chú", fieldKey: "ghiChu" },
  ]),
});

function getChungTuPdfFieldCatalog() {
  return CHUNG_TU_PDF_FIELD_CATALOG;
}

export { CHUNG_TU_PDF_FIELD_CATALOG, getChungTuPdfFieldCatalog };
