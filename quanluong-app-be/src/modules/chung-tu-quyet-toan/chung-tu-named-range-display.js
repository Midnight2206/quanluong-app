/** Named range → fieldKey (viết tắt / legacy). */
const NAMED_RANGE_LEGACY_FIELD_KEYS = Object.freeze({
  tongtienbanchu: "tongTienBangChu",
  tongtienbangchu: "tongTienBangChu",
  cancubkmh: "canCuBkmh",
  nguoinhanhang: "nguoiNhanHang",
  nguoi_nhan_hang: "nguoiNhanHang",
  donvi: "donVi",
  don_vi: "donVi",
  diachi: "donVi",
  dia_chi: "donVi",
});

const LABELED_FIELD_FORMATTERS = Object.freeze({
  quyenSo: (value) => `Quyển số: ${value}`,
  so: (value) => `Số: ${value}`,
  soChungTu: (value) => `Số: ${value}`,
  soPhieu: (value) => `Số: ${value}`,
  tongTienBangChu: (value) => `Tổng số tiền (Viết bằng chữ): ${value}`,
});

export function resolveLegacyNamedRangeFieldKey(normalizedName) {
  return NAMED_RANGE_LEGACY_FIELD_KEYS[normalizedName] ?? "";
}

/** Giá trị ghi vào named range (một ô). */
export function formatDerivedNamedRangeValue(fieldKey, rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";
  const format = LABELED_FIELD_FORMATTERS[fieldKey];
  return format ? format(value) : value;
}
