import { NL_FIELD_NAMED_RANGE_PREFIX, splitNamedRangePrefix } from "./chung-tu-named-range-prefix.js";

const NL_FIELD_KEY_BY_NAME = Object.freeze({
  can_cu_pnk: "canCuPnk",
  canCuPnk: "canCuPnk",
  don_vi: "donVi",
  donVi: "donVi",
  don_vi_cap_tren: "donViCapTren",
  donViCapTren: "donViCapTren",
  ngay_thang_nam: "ngayThangNam",
  ngayThangNam: "ngayThangNam",
});

export const NL_FIELD_CATALOG_SCALARS = Object.freeze([
  Object.freeze({
    namedRange: "NL_FIELD_can_cu_pnk",
    fieldKey: "canCuPnk",
    description: "Căn cứ PNK hardcoded từ BKMH (số, ngày, người mua)",
    supportsLabel: false,
  }),
  Object.freeze({
    namedRange: "NL_FIELD_don_vi",
    fieldKey: "donVi",
    description: "Tên đơn vị",
    supportsLabel: false,
  }),
  Object.freeze({
    namedRange: "NL_FIELD_don_vi_cap_tren",
    fieldKey: "donViCapTren",
    description: "Đơn vị cấp trên",
    supportsLabel: false,
  }),
  Object.freeze({
    namedRange: "NL_FIELD_ngay_thang_nam",
    fieldKey: "ngayThangNam",
    description: "Ngày DD tháng MM năm YYYY",
    supportsLabel: false,
  }),
]);

function formatDateClause(snapshot) {
  const iso = String(snapshot?.periodDate ?? "").trim();
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return ` ngày ${dd} tháng ${mm} năm ${yyyy}`;
  }

  const yyyy = String(snapshot?.nam ?? "").trim();
  const mm = String(snapshot?.thang ?? "").trim();
  const dd = String(snapshot?.ngay ?? "").trim();
  if (!yyyy || !mm || !dd) return "";
  return ` ngày ${dd.padStart(2, "0")} tháng ${mm.padStart(2, "0")} năm ${yyyy}`;
}

export function isNlFieldNamedRange(name) {
  return splitNamedRangePrefix(name).prefix === NL_FIELD_NAMED_RANGE_PREFIX;
}

export function resolveNlFieldKey(raw) {
  if (splitNamedRangePrefix(raw).prefix === "FIELD_") return "";
  const { fieldName } = splitNamedRangePrefix(raw);
  return NL_FIELD_KEY_BY_NAME[fieldName] ?? "";
}

export function formatCanCuPnkLine(snapshot) {
  const soChungTu = String(snapshot?.soChungTu ?? "").trim() || "—";
  const buyerName = String(snapshot?.buyerName ?? "").trim() || "—";
  return `Căn cứ vào BKMH số ${soChungTu}${formatDateClause(snapshot)} của đ/c ${buyerName}`;
}

export function formatCanCuPnkText(rows) {
  const lines = [];
  const seen = new Set();
  for (const row of rows ?? []) {
    const line = formatCanCuPnkLine(row);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines.join(", ");
}
