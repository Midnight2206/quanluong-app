const STATIC_ALIASES = Object.freeze({
  tong_tien_bang_chu: "tongTienBangChu",
  ngay_thang_nam: "ngayThangNam",
  ho_ten_nguoi_mua: "hoTenNguoiMua",
  nguoi_mua: "hoTenNguoiMua",
  can_cu_bkmh: "canCuBkmh",
});

const SCALAR_ALIASES = Object.freeze({
  so: "soChungTu",
  so_phieu: "soChungTu",
  soPhieu: "soChungTu",
});

function snakeToCamel(key) {
  return String(key ?? "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(key) {
  return String(key ?? "").replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Mirror BE resolveScalarFieldKey for PDF template label keys. */
export function resolvePdfScalarFieldKey(templateFieldKey, { categoryKey } = {}) {
  const raw = String(templateFieldKey ?? "").trim();
  const key = raw.startsWith("FIELD_") ? raw.slice("FIELD_".length) : raw;
  if (!key) return "";
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
