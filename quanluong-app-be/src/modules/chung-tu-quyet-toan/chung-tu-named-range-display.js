/** Named range → fieldKey (viết tắt / legacy). */
const NAMED_RANGE_LEGACY_FIELD_KEYS = Object.freeze({
  tongtienbanchu: "tongTienBangChu",
  tongtienbangchu: "tongTienBangChu",
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

export { formatDerivedNamedRangeValue } from "./chung-tu-label-field.js";
