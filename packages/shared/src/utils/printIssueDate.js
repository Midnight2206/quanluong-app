function parseYmd(input) {
  const m = String(input ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return null;
  }
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
}

export function formatIssueSlipPrintDate(input) {
  const parts = parseYmd(input);
  if (!parts) {
    return "";
  }
  const day = String(parts.day).padStart(2, "0");
  const month = parts.month <= 2 ? String(parts.month).padStart(2, "0") : String(parts.month);
  return `Ngày ${day} tháng ${month} năm ${parts.year}`;
}
