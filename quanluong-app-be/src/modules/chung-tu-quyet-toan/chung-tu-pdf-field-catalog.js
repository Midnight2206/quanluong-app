import { NL_FIELD_CATALOG_SCALARS } from "./chung-tu-nl-field.js";

const CHUNG_TU_PDF_FIELD_CATALOG = Object.freeze({
  scalarFields: Object.freeze([
    buildScalarField("FIELD_ngay", "ngay", "Ngày"),
    buildScalarField("FIELD_thang", "thang", "Tháng"),
    buildScalarField("FIELD_nam", "nam", "Năm"),
    buildScalarField(
      "FIELD_tong_tien_bang_chu",
      "tongTienBangChu",
      "Tổng tiền bằng chữ — PDF engine tự vẽ dưới «Cộng»; Named Range không bắt buộc cho PDF (giữ cho Drive nếu có)",
      { supportsLabel: true },
    ),
    buildScalarField("FIELD_tong_tien", "tongTien", "Tổng tiền (format VND)"),
    buildScalarField("FIELD_quyen_so", "quyenSo", "Quyển số", { supportsLabel: true }),
    buildScalarField("FIELD_so_chung_tu", "soChungTu", "Số chứng từ", { supportsLabel: true }),
    buildScalarField("FIELD_ho_ten_nguoi_mua", "hoTenNguoiMua", "Họ và tên người mua", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_bo_phan", "boPhan", "Bộ phận (BKMH) hoặc department người nhận (LTTP)", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_nguoi_giao_hang", "nguoiGiaoHang", "Họ tên người giao (từ người mua BKMH)", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_dia_chi", "diaChi", "Bộ phận người giao (PNK) hoặc phòng ban người nhận (PXK)", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_ly_do_nhap_kho", "lyDoNhapKho", "Lý do nhập kho", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_nhap_tai_kho", "nhapTaiKho", "Nhập tại kho", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_nguoi_nhan", "nguoiNhan", "Họ tên người nhận (LTTP)", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_ly_do_xuat_kho", "lyDoXuatKho", "Lý do xuất kho", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_xuat_tai_kho", "xuatTaiKho", "Xuất tại kho", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_dia_diem", "diaDiem", "Địa điểm", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_ly_do_su_dung", "lyDoSuDung", "Lý do sử dụng (cài đặt chữ ký đơn vị LTTP)", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_ngay_giao", "ngayGiao", "Ngày giao (= ngày phiếu)"),
    buildScalarField("FIELD_ngay_nhan", "ngayNhan", "Ngày nhận (trên phiếu)"),
    buildScalarField(
      "FIELD_print_line_1",
      "donViCapTren",
      "Dòng đơn vị in trái dòng 1 — cùng nguồn NL_FIELD_don_vi_cap_tren (hồ sơ người viết)",
    ),
    buildScalarField(
      "FIELD_print_line_2",
      "donVi",
      "Dòng đơn vị in trái dòng 2 — cùng nguồn NL_FIELD_don_vi (hồ sơ người viết)",
    ),
    buildScalarField("FIELD_form_mau_so", "formMauSo", "Mẫu số phiếu", { supportsLabel: true }),
    buildScalarField("FIELD_nhan_tai_kho", "nhanTaiKho", "Nhận tại kho (cài đặt chữ ký đơn vị)", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_nguoi_viet_phieu", "nguoiVietPhieu", "Người viết phiếu", {
      supportsLabel: true,
    }),
    buildScalarField("FIELD_nguoi_duyet", "nguoiDuyet", "Người duyệt", { supportsLabel: true }),
    ...NL_FIELD_CATALOG_SCALARS.map((field) => ({ ...field, label: field.description })),
    buildScalarField("FIELD_ghi_chu", "ghiChu", "Ghi chú"),
  ]),
  tableColumns: Object.freeze([
    { label: "STT", fieldKey: "stt" },
    { label: "Tên hàng", fieldKey: "tenHang" },
    { label: "Tên mặt hàng", fieldKey: "tenHang" },
    { label: "ĐVT", fieldKey: "dvt" },
    { label: "Số lượng", fieldKey: "soLuong" },
    { label: "Mua TT", fieldKey: "muaTt" },
    { label: "TGSX", fieldKey: "tgsx" },
    { label: "Đơn giá", fieldKey: "donGia" },
    { label: "Thành tiền", fieldKey: "thanhTien" },
    { label: "Người bán", fieldKey: "nguoiBan" },
    { label: "Ghi chú", fieldKey: "ghiChu" },
  ]),
});

function buildScalarField(namedRange, fieldKey, description, { supportsLabel = false } = {}) {
  return Object.freeze({
    namedRange,
    fieldKey,
    description,
    label: description,
    supportsLabel,
  });
}

function getChungTuPdfFieldCatalog() {
  return CHUNG_TU_PDF_FIELD_CATALOG;
}

export { CHUNG_TU_PDF_FIELD_CATALOG, getChungTuPdfFieldCatalog };
