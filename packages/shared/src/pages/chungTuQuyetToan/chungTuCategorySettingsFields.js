/** Trường settings theo loại chứng từ — khớp fieldKey map lên Google Sheets. */
export const CHUNG_TU_DEFAULT_SETTINGS_FIELDS = [
  { key: "donViCapTren", label: "Đơn vị cấp trên" },
  { key: "donViSo", label: "Đơn vị soạn" },
  { key: "mauSo", label: "Mẫu số" },
  { key: "quyenSo", label: "Quyển số" },
  { key: "soChungTu", label: "Số chứng từ" },
  { key: "hoTenNguoiMua", label: "Họ tên người mua hàng" },
  { key: "boPhan", label: "Bộ phận" },
  { key: "noTaiKhoan", label: "Nợ …" },
  { key: "coTaiKhoan", label: "Có …" },
  { key: "ghiChu", label: "Ghi chú", full: true },
  { key: "signerWriter", label: "Người viết" },
  { key: "signerApprover", label: "Người duyệt" },
  { key: "signerThird", label: "Người ký thứ ba" },
];

/** Bảng kê mua hàng — 9 thông số header + chữ ký theo mẫu in. */
export const BANG_KE_MUA_HANG_SETTINGS_FIELDS = [
  { key: "donViCapTren", label: "Đơn vị cấp trên" },
  { key: "donViSo", label: "Đơn vị cấp mình" },
  { key: "boPhan", label: "Bộ phận" },
  { key: "signerNguoiMua", label: "Người mua" },
  { key: "signerPhuTrachBoPhan", label: "Phụ trách bộ phận" },
  { key: "signerTaiChinh", label: "Tài chính" },
  { key: "signerApprover", label: "Thủ trưởng đơn vị" },
];

const BY_CATEGORY = Object.freeze({
  "bang-ke-mua-hang": BANG_KE_MUA_HANG_SETTINGS_FIELDS,
});

export function getChungTuCategorySettingsFields(categoryKey) {
  const k = String(categoryKey ?? "").trim();
  return BY_CATEGORY[k] ?? CHUNG_TU_DEFAULT_SETTINGS_FIELDS;
}

/** Keys lưu vào ChungTuUnitProfile (mặc định đơn vị) theo category. */
export function getChungTuCategoryProfilePersistKeys(categoryKey) {
  const fields = getChungTuCategorySettingsFields(categoryKey);
  return fields
    .map((f) => f.key)
    .filter((key) => key !== "donViSo" && key !== "soChungTu" && key !== "ghiChu");
}
