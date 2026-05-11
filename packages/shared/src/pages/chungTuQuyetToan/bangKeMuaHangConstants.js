/** `categoryKey` thống nhất với backend / superadmin danh mục. */
export const BANG_KE_MUA_HANG_CATEGORY_KEY = "bang-ke-mua-hang";

export const BKMH_DEFAULT_FORM = Object.freeze({
  donViCapTren: "Sư đoàn 372",
  donViSo: "Trung đoàn 925",
  mauSo: "C34",
  quyenSo: "",
  soChungTu: "",
  hoTenNguoiMua: "",
  boPhan: "",
  noTaiKhoan: "",
  coTaiKhoan: "",
  tongTienBangChu: "",
  ghiChu: "",
  chiTietDongBang: "",
});

export const BKMH_DRAFT_STORAGE_KEY = "ql.chungTu.bkmh.draft.v1";

/**
 * Chuẩn bố cục bảng theo mẫu `BKMH925.xlsx` (sheet `01`) —
 * 9 ô logic: TT | Tên | ĐVT | [Tên người bán ×3] | Số lượng | Đơn giá | Thành tiền (không có cột Mã số riêng).
 */
export const BKMH_TEMPLATE_SPEC = Object.freeze({
  sourceFile: "BKMH925.xlsx",
  sheetName: "01",
  title: "BẢNG KÊ MUA HÀNG",
  tableHeaderRow: Object.freeze([
    "TT",
    "Tên, quy cách, phẩm chất vật tư, hàng hóa, dụng cụ",
    "ĐVT",
    "Tên người bán hoặc địa chỉ mua hàng",
    "Số lượng",
    "Đơn giá",
    "Thành tiền",
  ]),
  /** Thứ tự nhập «Chi tiết bảng» khi dùng dấu | (đủ 7 trường, khớp preview & mẫu hiện tại). */
  detailPipeOrder7: Object.freeze(["TT", "Tên hàng", "ĐVT", "Tên người bán", "Số lượng", "Đơn giá", "Thành tiền"]),
});
