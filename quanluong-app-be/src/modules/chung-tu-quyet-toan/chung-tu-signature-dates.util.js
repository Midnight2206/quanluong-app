/**
 * Ngày ký trên khung chữ ký — auto theo aggregation.
 * by-day → ngày slice; by-unit / full → ngày cuối tháng.
 */

function ymdParts(periodDate) {
  const d = String(periodDate ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  return { ngay: m[3], thang: m[2], nam: m[1] };
}

/** YYYY-MM-DD → "Ngày DD tháng MM năm YYYY" */
export function formatNgayThangNamLabel(periodDate) {
  const parts = ymdParts(periodDate);
  if (!parts) return "";
  return `Ngày ${parts.ngay} tháng ${parts.thang} năm ${parts.nam}`;
}

/**
 * Chọn ngày dùng cho dòng ký.
 * Ưu tiên ngayThangNam trên context (đã build sẵn); fallback từ periodDate / cuối tháng.
 */
export function resolveSignatureDateLabel({
  aggregationMode,
  periodDate,
  periodMonth,
  ngayThangNam,
  lastDayOfMonthFn,
} = {}) {
  const fromContext = String(ngayThangNam ?? "").trim();
  if (fromContext) return fromContext;

  const day = String(periodDate ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return formatNgayThangNamLabel(day);
  }

  const month = String(periodMonth ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(month) && typeof lastDayOfMonthFn === "function") {
    // by-unit / full (và mọi mode thiếu periodDate) → cuối tháng
    return formatNgayThangNamLabel(lastDayOfMonthFn(month));
  }
  return "";
}

/**
 * Điền signatureDates cho mọi slot có show_date_line.
 * Auto date ghi đè giá trị trống / thủ công — nguồn sự thật là kỳ dữ liệu của slice.
 */
export function fillSignatureDatesFromPeriod({
  signatureBlock,
  signatureDates = {},
  context = {},
  aggregationMode,
  periodMonth,
  lastDayOfMonthFn,
} = {}) {
  const slots = Array.isArray(signatureBlock?.slots) ? signatureBlock.slots : [];
  const dateKeys = slots
    .filter((slot) => slot?.show_date_line && String(slot?.key ?? "").trim())
    .map((slot) => String(slot.key).trim());
  if (dateKeys.length === 0) {
    return signatureDates && typeof signatureDates === "object" ? { ...signatureDates } : {};
  }

  const label = resolveSignatureDateLabel({
    aggregationMode,
    periodDate: context.periodDate ?? context.ngayChungTu,
    periodMonth: periodMonth ?? context.periodMonth,
    ngayThangNam: context.ngayThangNam,
    lastDayOfMonthFn,
  });

  const out = signatureDates && typeof signatureDates === "object" ? { ...signatureDates } : {};
  if (!label) return out;
  for (const key of dateKeys) {
    out[key] = label;
  }
  return out;
}
