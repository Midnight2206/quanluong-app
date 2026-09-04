import {
  guessDetailFieldKeyFromLabel,
  CHUNG_TU_DETAIL_FIELD_KEYS,
} from "./chung-tu-detail-field-catalog.js";
import { camelToSnake } from "./chung-tu-pdf-map.util.js";

const STATIC_ALIASES = Object.freeze({
  tt: "stt",
  so_tt: "stt",
  ten_mat_hang: "tenHang",
  ten_hang: "tenHang",
  ten_hang_hoa: "tenHang",
  ten_nguoi_ban_hoac_dia_chi_mua_hang: "nguoiBan",
  thanh_tien_vnd: "thanhTien",
  tong_tien_bang_chu: "tongTienBangChu",
  ngay_thang_nam: "ngayThangNam",
  ho_ten_nguoi_mua: "hoTenNguoiMua",
  ho_va_ten_nguoi_mua: "hoTenNguoiMua",
  hoten_nguoi_mua: "hoTenNguoiMua",
  nguoi_mua: "hoTenNguoiMua",
  can_cu_bkmh: "canCuBkmh",
});

function snakeToCamel(key) {
  return String(key ?? "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function resolveColumnFieldKey(templateColumnKey) {
  const key = String(templateColumnKey ?? "").trim();
  if (!key) return "";
  if (STATIC_ALIASES[key]) return STATIC_ALIASES[key];
  if (CHUNG_TU_DETAIL_FIELD_KEYS.has(key)) return key;
  const snakeAsCamel = snakeToCamel(key);
  if (CHUNG_TU_DETAIL_FIELD_KEYS.has(snakeAsCamel)) return snakeAsCamel;
  const fromLabel = guessDetailFieldKeyFromLabel(key.replace(/_/g, " "));
  if (fromLabel) return fromLabel;
  return camelToSnake(key) === key ? snakeAsCamel : "";
}

export function resolveScalarFieldKey(templateFieldKey) {
  const raw = String(templateFieldKey ?? "").trim();
  const key = raw.startsWith("FIELD_") ? raw.slice("FIELD_".length) : raw;
  if (!key) return "";
  if (STATIC_ALIASES[key]) return STATIC_ALIASES[key];
  if (camelToSnake(key) === key) return snakeToCamel(key);
  return key;
}
