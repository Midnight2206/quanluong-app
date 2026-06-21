export function parseVietnameseNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function amountFromRow(row, amountFieldKey = "thanhTien") {
  if (!row || typeof row !== "object") return 0;
  if (amountFieldKey && Object.prototype.hasOwnProperty.call(row, amountFieldKey)) {
    return parseVietnameseNumber(row[amountFieldKey]);
  }
  if (Object.prototype.hasOwnProperty.call(row, "thanhTienSo")) {
    return parseVietnameseNumber(row.thanhTienSo);
  }
  return parseVietnameseNumber(row.thanhTien);
}
