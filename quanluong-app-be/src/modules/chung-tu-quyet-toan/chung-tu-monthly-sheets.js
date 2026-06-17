export function normalizePeriodMonth(periodMonth) {
  const value = String(periodMonth ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error("periodMonth phải dạng YYYY-MM.");
  }
  return value;
}

export function buildMonthDaySheetNames(periodMonth) {
  const month = normalizePeriodMonth(periodMonth);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const dayCount = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return Array.from({ length: dayCount }, (_unused, index) =>
    String(index + 1).padStart(2, "0"),
  );
}

export function normalizeMonthUnitIds(unitIds) {
  const ids = [];
  const seen = new Set();
  for (const value of Array.isArray(unitIds) ? unitIds : []) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.sort((a, b) => a - b);
}

export function resolveTemplateSheetTitle(sheetTitles) {
  const titles = (Array.isArray(sheetTitles) ? sheetTitles : [])
    .map((title) => String(title ?? "").trim())
    .filter(Boolean);
  if (titles.includes("01")) return "01";
  const firstDaySheet = titles.find((title) => /^\d{2}$/.test(title));
  return firstDaySheet ?? titles[0] ?? "";
}
