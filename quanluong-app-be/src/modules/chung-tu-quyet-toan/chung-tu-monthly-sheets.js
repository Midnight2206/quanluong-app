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

/** Ngày cuối tháng dạng YYYY-MM-DD (UTC). */
export function lastDayOfMonth(periodMonth) {
  const month = normalizePeriodMonth(periodMonth);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const dayCount = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return `${month}-${String(dayCount).padStart(2, "0")}`;
}

/** Google Sheets tab title — loại ký tự cấm, giới hạn độ dài. */
export function sanitizeSheetTitle(name, { maxLen = 31 } = {}) {
  const raw = String(name ?? "").trim();
  const cleaned = raw
    .replace(/[\[\]:*?/\\]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const limit = Math.max(Number(maxLen) || 31, 1);
  if (!cleaned) return "Sheet";
  return cleaned.length > limit ? cleaned.slice(0, limit).trim() : cleaned;
}

/**
 * @param {number[]} unitIds
 * @param {Map<number, string>|Record<number, string>} unitNameById
 * @returns {{ unitId: number, sheetTitle: string }[]}
 */
export function buildUnitSheetTitles(unitIds, unitNameById) {
  const ids = normalizeMonthUnitIds(unitIds);
  const nameMap =
    unitNameById instanceof Map
      ? unitNameById
      : new Map(
          Object.entries(unitNameById ?? {}).map(([k, v]) => [Number(k), String(v ?? "")]),
        );
  const usedTitles = new Set();
  const result = [];
  for (const unitId of ids) {
    const baseName = nameMap.get(unitId)?.trim() || `Đơn vị ${unitId}`;
    let title = sanitizeSheetTitle(baseName);
    if (usedTitles.has(title)) {
      const suffix = ` (${unitId})`;
      const maxBase = Math.max(31 - suffix.length, 1);
      title = `${sanitizeSheetTitle(baseName, { maxLen: maxBase })}${suffix}`;
    }
    if (usedTitles.has(title)) {
      title = sanitizeSheetTitle(`Đơn vị ${unitId}`);
    }
    usedTitles.add(title);
    result.push({ unitId, sheetTitle: title });
  }
  return result;
}
