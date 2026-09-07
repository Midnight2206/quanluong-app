import { CHUNG_TU_AGGREGATION_MODES } from "./chung-tu-category.constants.js";

function hasDetailRows(context) {
  return Array.isArray(context?.detailRows) && context.detailRows.length > 0;
}

function sanitizeFileBaseName(value, fallback = "document") {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/\.+$/g, "")
    .trim();
  return cleaned || fallback;
}

function ensureUniqueFileName(baseName, usedNames) {
  const safeBase = sanitizeFileBaseName(baseName);
  let attempt = safeBase;
  let index = 2;
  while (usedNames.has(`${attempt}.pdf`)) {
    attempt = `${safeBase}-${index}`;
    index += 1;
  }
  const fileName = `${attempt}.pdf`;
  usedNames.add(fileName);
  return fileName;
}

function buildByDaySlice(context, usedNames) {
  const periodDate = String(context?.periodDate ?? "").trim();
  const recipientUnitId = context?.recipientUnitId;
  let base;
  if (recipientUnitId != null && recipientUnitId !== "") {
    const unitPart = sanitizeFileBaseName(
      context.recipientUnitName || `dv-${recipientUnitId}` || "",
    );
    const dayPart = periodDate;
    base = [unitPart, dayPart].filter(Boolean).join("-") || dayPart;
  } else {
    base = periodDate || String(context?.sheetName ?? "").trim() || "day";
  }
  return {
    context,
    fileName: ensureUniqueFileName(base, usedNames),
    sortKey: base,
  };
}

function buildByUnitSlice(context, usedNames) {
  const unitName = String(context?.recipientUnitName ?? "").trim();
  const fallbackName =
    unitName ||
    String(context?.sheetName ?? "").trim() ||
    (context?.recipientUnitId ? `don-vi-${context.recipientUnitId}` : "don-vi");
  return {
    context,
    fileName: ensureUniqueFileName(fallbackName, usedNames),
    sortKey: unitName || fallbackName,
  };
}

function buildFullSlice(context, usedNames) {
  const categoryKey = String(context?.categoryKey ?? "").trim() || "chung-tu";
  const periodMonth = String(context?.periodMonth ?? "").trim();
  const baseName = periodMonth ? `${categoryKey}-${periodMonth}` : categoryKey;
  return {
    context,
    fileName: ensureUniqueFileName(baseName, usedNames),
    sortKey: periodMonth || categoryKey,
  };
}

function pickExportSlices({ aggregationMode, context }) {
  const rootContext = context && typeof context === "object" ? context : {};
  const usedNames = new Set();

  if (aggregationMode === CHUNG_TU_AGGREGATION_MODES.BY_DAY) {
    return (Array.isArray(rootContext.sheetContexts) ? rootContext.sheetContexts : [])
      .filter(hasDetailRows)
      .map((slice) => buildByDaySlice(slice, usedNames));
  }

  if (aggregationMode === CHUNG_TU_AGGREGATION_MODES.BY_UNIT) {
    return (Array.isArray(rootContext.sheetContexts) ? rootContext.sheetContexts : [])
      .filter(hasDetailRows)
      .map((slice) => buildByUnitSlice(slice, usedNames));
  }

  if (!hasDetailRows(rootContext)) {
    return [];
  }

  return [buildFullSlice(rootContext, usedNames)];
}

export { pickExportSlices, sanitizeFileBaseName };
