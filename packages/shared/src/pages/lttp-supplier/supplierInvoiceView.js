/** Ngày ISO `YYYY-MM-DD` → `Ngày d tháng m năm yyyy` (không zero-pad). */
export function formatInvoiceLongDate(iso) {
  const [year, month, day] = String(iso ?? "").split("-");
  if (!year || !month || !day) return "";
  return `Ngày ${Number(day)} tháng ${Number(month)} năm ${year}`;
}

/** Cộng/trừ ngày lịch trên chuỗi `YYYY-MM-DD` (UTC calendar). */
export function shiftInvoiceDateYmd(iso, deltaDays) {
  const [year, month, day] = String(iso ?? "").split("-").map(Number);
  if (!year || !month || !day || !Number.isFinite(deltaDays)) return iso;
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}
