/** Loại chứng từ quyết toán — khớp tab UI và tên folder con trên Drive hệ thống. */
export const CHUNG_TU_CATEGORY_KEYS = Object.freeze({
  BANG_KE_MUA_HANG: "bang-ke-mua-hang",
  PHIEU_XUAT_KHO: "phieu-xuat-kho",
  PHIEU_NHAP_KHO: "phieu-nhap-kho",
});

export const CHUNG_TU_CATEGORY_LIST = Object.freeze([
  {
    key: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    label: "Bảng kê mua hàng",
    mode: "by-date",
    folderName: "bang-ke-mua-hang",
  },
  {
    key: CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
    label: "Phiếu xuất kho",
    mode: "by-slip",
    folderName: "phieu-xuat-kho",
  },
  {
    key: CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO,
    label: "Phiếu nhập kho",
    mode: "by-date",
    folderName: "phieu-nhap-kho",
  },
]);

export const CHUNG_TU_TEMPLATE_ROOT_FOLDER_NAME = "chung-tu-quyet-toan-template";
export const CHUNG_TU_GENERATED_ROOT_FOLDER_NAME = "chung-tu-quyet-toan-generated";

export const CHUNG_TU_DOCUMENT_STATUS = Object.freeze({
  DRAFT: "draft",
  SYNCED: "synced",
  STALE: "stale",
  LOCKED: "locked",
});

/** Cấu hình in Google Sheets mặc định — 40 dòng/trang, 18pt/dòng; wrap đọc từ template. */
export const CHUNG_TU_DEFAULT_SHEET_PRINT = Object.freeze({
  rowsPerPage: 40,
  rowHeightPt: 18,
  enabled: true,
  amountFieldKey: "thanhTien",
  labelFieldKey: "tenHang",
  carryInLabel: "Mang sang",
  carryOutLabel: "Cộng sang trang",
});

/** Cấu hình ghi bảng chi tiết mặc định (0-based row/col) khi chưa có fillRules. */
export const CHUNG_TU_DEFAULT_SHEET_TABLE = Object.freeze({
  [CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG]: {
    startRow: 8,
    startCol: 0,
    columns: ["stt", "tenHang", "dvt", "nguoiBan", "soLuong", "donGia", "thanhTien"],
    repeatHeaderEveryRows: 40,
    repeatHeaderLabels: ["STT", "Tên hàng", "ĐVT", "Người bán", "Số lượng", "Đơn giá", "Thành tiền"],
    rowsPerPage: 40,
    rowHeightPt: 18,
  },
  [CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO]: {
    startRow: 8,
    startCol: 0,
    columns: ["stt", "tenHang", "dvt", "nguoiBan", "soLuong", "donGia", "thanhTien"],
  },
  [CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO]: {
    startRow: 9,
    startCol: 0,
    columns: ["stt", "tenHang", "maSo", "dvt", "soLuong", "donGia", "thanhTien", "ghiChu"],
  },
});

export function getCategoryMeta(categoryKey) {
  const k = String(categoryKey ?? "").trim();
  return CHUNG_TU_CATEGORY_LIST.find((c) => c.key === k) ?? null;
}

export function assertKnownCategoryKey(categoryKey) {
  const meta = getCategoryMeta(categoryKey);
  if (!meta) {
    const err = new Error(`categoryKey không hợp lệ: ${categoryKey}`);
    err.code = "INVALID_CATEGORY";
    throw err;
  }
  return meta;
}
