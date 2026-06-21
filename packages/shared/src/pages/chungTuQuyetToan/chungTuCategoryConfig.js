import { CHUNG_TU_DERIVED_NAMED_RANGE_NAMES } from "./chungTuDerivedNamedRanges";
import {
  CHUNG_TU_DOC_TAB_STATUS,
  CHUNG_TU_QUYET_TOAN_DOCUMENT_TABS,
} from "./chungTuQuyetToanTabsMeta";

/** Cách xuất dữ liệu LTTP cho từng loại chứng từ. */
export const CHUNG_TU_EXPORT_KIND = Object.freeze({
  MONTHLY: "monthly",
  BY_SLIP: "by-slip",
  BY_DATE: "by-date",
});

/**
 * Named range chuẩn theo loại — chỉ cần thêm/bớt ở đây khi có loại mới.
 * @type {Record<string, readonly string[]>}
 */
const CATEGORY_DERIVED_NAMED_RANGES = Object.freeze({
  "bang-ke-mua-hang": CHUNG_TU_DERIVED_NAMED_RANGE_NAMES,
  "phieu-xuat-kho": Object.freeze([
    "ngay",
    "thang",
    "nam",
    "ngayThangNam",
    "so",
    "soPhieu",
    "quyenSo",
    "tongTienBangChu",
    "nguoiNhanHang",
    "donVi",
  ]),
  "phieu-nhap-kho": Object.freeze([
    "ngay",
    "thang",
    "nam",
    "ngayThangNam",
    "so",
    "soChungTu",
    "quyenSo",
    "tongTienBangChu",
    "canCuBkmh",
    "nguoiNhanHang",
    "donVi",
  ]),
});

/**
 * @typedef {{
 *   categoryKey: string,
 *   label: string,
 *   status: "available"|"planned",
 *   exportKind?: "monthly"|"by-slip"|"by-date",
 *   subtitle: string,
 *   hint?: string,
 *   derivedNamedRangeNames?: readonly string[],
 * }} ChungTuCategoryConfig
 */

/** @type {ChungTuCategoryConfig[]} */
export const CHUNG_TU_CATEGORY_CONFIG_LIST = CHUNG_TU_QUYET_TOAN_DOCUMENT_TABS.map((tab) => {
  const exportKindById = Object.freeze({
    "bang-ke-mua-hang": CHUNG_TU_EXPORT_KIND.MONTHLY,
    "phieu-xuat-kho": CHUNG_TU_EXPORT_KIND.MONTHLY,
    "phieu-nhap-kho": CHUNG_TU_EXPORT_KIND.MONTHLY,
  });
  return {
    categoryKey: tab.id,
    label: tab.label,
    status: tab.status,
    exportKind: exportKindById[tab.id],
    subtitle: tab.subtitle,
    hint: tab.hint,
    derivedNamedRangeNames:
      CATEGORY_DERIVED_NAMED_RANGES[tab.id] ?? CHUNG_TU_DERIVED_NAMED_RANGE_NAMES,
  };
});

/** @type {Map<string, ChungTuCategoryConfig>} */
const CONFIG_BY_KEY = new Map(CHUNG_TU_CATEGORY_CONFIG_LIST.map((c) => [c.categoryKey, c]));

export function getChungTuCategoryConfig(categoryKey) {
  const key = String(categoryKey ?? "").trim();
  return CONFIG_BY_KEY.get(key) ?? null;
}

export function getChungTuCategoryNamedRangeNames(categoryKey) {
  return getChungTuCategoryConfig(categoryKey)?.derivedNamedRangeNames ?? CHUNG_TU_DERIVED_NAMED_RANGE_NAMES;
}

export function listAvailableChungTuCategoryConfigs() {
  return CHUNG_TU_CATEGORY_CONFIG_LIST.filter((c) => c.status === CHUNG_TU_DOC_TAB_STATUS.AVAILABLE);
}

export const DEFAULT_CHUNG_TU_CATEGORY_KEY =
  listAvailableChungTuCategoryConfigs()[0]?.categoryKey ?? "bang-ke-mua-hang";
