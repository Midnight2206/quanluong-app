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

export function resolveLegacyNamedRangeFieldKey(normalizedName) {
  return NAMED_RANGE_LEGACY_FIELD_KEYS[normalizedName] ?? "";
}

/** Giá trị ghi vào named range (một ô). */
export function formatDerivedNamedRangeValue(fieldKey, rawValue, { label } = {}) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";
  const prefix = String(label ?? "");
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix) return value;
  if (value.startsWith(prefix) || value.startsWith(normalizedPrefix) || value.startsWith(prefix.trimEnd())) {
    return value;
  }
  return `${prefix}${value}`;
}
