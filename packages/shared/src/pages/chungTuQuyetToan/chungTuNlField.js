export const NL_FIELD_PREFIX = "NL_FIELD_";

const NL_FIELD_KEY_ALIASES = Object.freeze({
  can_cu_pnk: "canCuPnk",
  don_vi: "donVi",
  donVi: "donVi",
  don_vi_cap_tren: "donViCapTren",
  donViCapTren: "donViCapTren",
  ngay_thang_nam: "ngayThangNam",
  ngayThangNam: "ngayThangNam",
});

function normalizeNamedRange(value) {
  return String(value ?? "").trim();
}

export function isNlFieldNamedRange(namedRange) {
  const value = normalizeNamedRange(namedRange);
  return value.startsWith(NL_FIELD_PREFIX) && value.length > NL_FIELD_PREFIX.length;
}

export function stripNlFieldPrefix(namedRange) {
  const value = normalizeNamedRange(namedRange);
  return isNlFieldNamedRange(value) ? value.slice(NL_FIELD_PREFIX.length) : value;
}

export function resolveNlFieldKey(templateFieldKey) {
  const raw = normalizeNamedRange(templateFieldKey);
  if (!raw || raw.startsWith("FIELD_")) return "";
  return NL_FIELD_KEY_ALIASES[stripNlFieldPrefix(raw)] ?? "";
}
