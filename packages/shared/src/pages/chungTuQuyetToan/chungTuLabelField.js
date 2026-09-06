import { resolveNlFieldKey } from "./chungTuNlField.js";

export const FIELD_PREFIX = "FIELD_";

const STATIC_ALIASES = Object.freeze({
  tong_tien_bang_chu: "tongTienBangChu",
  ngay_thang_nam: "ngayThangNam",
  ho_ten_nguoi_mua: "hoTenNguoiMua",
  nguoi_mua: "hoTenNguoiMua",
  can_cu_pnk: "canCuPnk",
  ly_do_nhap_kho: "lyDoNhapKho",
});

const SCALAR_ALIASES = Object.freeze({
  so: "soChungTu",
  so_phieu: "soChungTu",
  soPhieu: "soChungTu",
});

const LEGACY_NL_ONLY_FIELD_NAMES = new Set([
  "don_vi",
  "donVi",
  "don_vi_cap_tren",
  "donViCapTren",
  "ngay_thang_nam",
  "ngayThangNam",
]);

function normalizeNamedRange(value) {
  return String(value ?? "").trim();
}

function snakeToCamel(key) {
  return String(key ?? "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(key) {
  return String(key ?? "").replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function isLabelFieldNamedRange(namedRange) {
  const value = normalizeNamedRange(namedRange);
  return value.startsWith(FIELD_PREFIX) && value.length > FIELD_PREFIX.length;
}

export function stripLabelFieldPrefix(namedRange) {
  const value = normalizeNamedRange(namedRange);
  return isLabelFieldNamedRange(value) ? value.slice(FIELD_PREFIX.length) : value;
}

/** Mirror BE resolveScalarFieldKey for PDF template label keys. */
export function resolvePdfScalarFieldKey(templateFieldKey, { categoryKey } = {}) {
  const raw = normalizeNamedRange(templateFieldKey);
  const nlFieldKey = resolveNlFieldKey(raw);
  if (nlFieldKey) return nlFieldKey;

  const key = stripLabelFieldPrefix(raw);
  if (!key) return "";
  if (isLabelFieldNamedRange(raw) && LEGACY_NL_ONLY_FIELD_NAMES.has(key)) return "";
  if (key === "can_cu_bkmh" || key === "canCuBkmh") return "";
  if (
    String(categoryKey ?? "").trim() === "phieu-nhap-kho" &&
    (key === "dia_chi" || key === "diaChi")
  ) {
    return "diaChi";
  }
  if (SCALAR_ALIASES[key]) return SCALAR_ALIASES[key];
  if (STATIC_ALIASES[key]) return STATIC_ALIASES[key];
  if (camelToSnake(key) === key) return snakeToCamel(key);
  return key;
}
