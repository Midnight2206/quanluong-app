export function padDocNumber(seq) {
  return String(Math.trunc(Number(seq))).padStart(4, "0");
}

export function quyenSoFromPeriodMonth(periodMonth) {
  const m = String(periodMonth || "").trim();
  const [y, mo] = m.split("-");
  if (!y || !mo) return "";
  return `${mo}${y.slice(-2)}`;
}

export function buildSheetKey(input) {
  switch (input.kind) {
    case "by-unit":
      return `unit:${Number(input.recipientUnitId)}`;
    case "by-day-pxk":
      return `unit:${Number(input.recipientUnitId)}|day:${input.periodDate}`;
    case "by-day-bkmh":
      return `day:${input.periodDate}`;
    case "slip":
      return `slip:${Number(input.issueSlipId)}`;
    case "bkmh-slice":
      return `bkmhSlice:${Number(input.bkmhSliceId)}`;
    default:
      throw new Error(`Unknown sheetKey kind: ${input.kind}`);
  }
}
