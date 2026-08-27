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

const LABELED_FIELD_PREFIXES = Object.freeze({
  quyenSo: "Quyển số: ",
  so: "Số: ",
  soChungTu: "Số: ",
  soPhieu: "Số: ",
  tongTienBangChu: "Tổng số tiền (Viết bằng chữ): ",
});

export function resolveLegacyNamedRangeFieldKey(normalizedName) {
  return NAMED_RANGE_LEGACY_FIELD_KEYS[normalizedName] ?? "";
}

/** Giá trị ghi vào named range (một ô). */
export function formatDerivedNamedRangeValue(fieldKey, rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";
  const prefix = LABELED_FIELD_PREFIXES[fieldKey];
  if (!prefix) return value;
  if (value.startsWith(prefix.trimEnd()) || value.startsWith(prefix)) return value;
  return `${prefix}${value}`;
}
