import { createSheetsClient } from "../../shared/utils/google-sheets-fetch.api.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { assertTemplateInCategoryFolder } from "./chung-tu-drive-folders.service.js";
import { normalizeFillRulesV2 } from "./chung-tu-quyet-toan.service.js";
import { getContextFieldRegistryForCategory } from "./chung-tu-context-field-registry.js";
import {
  CHUNG_TU_CATEGORY_KEYS,
  CHUNG_TU_DEFAULT_SHEET_TABLE,
  CHUNG_TU_DEFAULT_SHEET_PRINT,
  CHUNG_TU_DERIVED_NAMED_RANGE_NAMES,
  excelColumnLetter,
  getDerivedNamedRangeNamesForCategory,
  getDerivedNamedRangeSetForCategory,
  getSuggestedColumnSlotsForCategory,
  mergeColumnMappingsWithSuggestedSlots,
  isIncompleteColumnSlotConfig,
} from "./chung-tu-category.constants.js";

import {
  CHUNG_TU_DETAIL_FIELD_CATALOG,
  guessDetailFieldKeyFromLabel,
  resolveDetailColumnMappings,
} from "./chung-tu-detail-field-catalog.js";
import {
  formatDerivedNamedRangeValue,
  resolveLegacyNamedRangeFieldKey,
} from "./chung-tu-named-range-display.js";

const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";

const CONTEXT_DERIVED_FIELDS = Object.freeze(
  CHUNG_TU_DERIVED_NAMED_RANGE_NAMES.map((fieldKey) => {
    const labels = {
      ngay: "Ngày (dd)",
      thang: "Tháng (mm)",
      nam: "Năm (yyyy)",
      ngayThangNam: "Ngày tháng năm (Ngày dd tháng mm năm yyyy)",
      so: "Số (quyenSo + ngày dd)",
      soChungTu: "Số chứng từ (quyenSo + ngày dd)",
      soPhieu: "Số phiếu (quyenSo + ngày dd)",
      quyenSo: "Quyển số (mmyy)",
      tongTienBangChu: "Tổng tiền bằng chữ",
      canCuBkmh: "Căn cứ theo BKMH (số, người mua, ngày)",
      nguoiNhanHang: "Người nhận hàng",
      donVi: "Đơn vị nhận",
    };
    return { fieldKey, label: labels[fieldKey] ?? fieldKey };
  }),
);

function buildContextDerivedFieldsForCategory(categoryKey) {
  return getDerivedNamedRangeNamesForCategory(categoryKey).map((fieldKey) => {
    const base = CONTEXT_DERIVED_FIELDS.find((item) => item.fieldKey === fieldKey);
    return base ?? { fieldKey, label: fieldKey };
  });
}

export {
  buildContextDerivedFieldsForCategory,
  CHUNG_TU_DERIVED_NAMED_RANGE_NAMES,
  CHUNG_TU_DETAIL_FIELD_CATALOG,
  formatDerivedNamedRangeValue,
};

/** Chuẩn hóa tên named range → camelCase fieldKey (bỏ dấu, khoảng trắng, gạch dưới). */
function normalizeRangeNameForMatch(name) {
  return String(name ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}

function assertFillRulesObject(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError({
      message: "fillRules phải là object JSON.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function buildKnownFieldKeys(registry, categoryKey) {
  const keys = new Set();
  for (const f of registry.formFields ?? []) {
    if (f.fieldKey) keys.add(f.fieldKey);
  }
  for (const f of buildContextDerivedFieldsForCategory(categoryKey)) {
    keys.add(f.fieldKey);
  }
  for (const f of CHUNG_TU_DETAIL_FIELD_CATALOG) {
    keys.add(f.fieldKey);
  }
  for (const t of registry.dbTables ?? []) {
    for (const c of t.columns ?? []) {
      if (c.fieldKeyHint) keys.add(c.fieldKeyHint);
    }
  }
  return [...keys];
}

function matchFieldKeyForRangeName(name, fieldKeys) {
  const list = Array.isArray(fieldKeys) ? fieldKeys : [...(fieldKeys ?? [])];
  const normalized = normalizeRangeNameForMatch(name);
  if (!normalized) return "";
  const legacy = resolveLegacyNamedRangeFieldKey(normalized);
  if (legacy && list.includes(legacy)) return legacy;
  return list.find((k) => k.toLowerCase() === normalized) ?? "";
}

function defaultDetailTableForCategory(categoryKey) {
  const def = CHUNG_TU_DEFAULT_SHEET_TABLE[categoryKey];
  if (!def) return null;
  return {
    sheetName: String(def.sheetName ?? "").trim(),
    startRow: def.startRow,
    startCol: def.startCol,
    headerRow: Number.isFinite(Number(def.headerRow)) ? Number(def.headerRow) : null,
    templateRow: Number(def.templateRow ?? def.startRow),
    totalTemplateRow: Number(def.totalTemplateRow ?? def.startRow + 1),
    columns: [...def.columns],
    rowHeightPt: Number(def.rowHeightPt ?? CHUNG_TU_DEFAULT_SHEET_PRINT.rowHeightPt),
    amountFieldKey: CHUNG_TU_DEFAULT_SHEET_PRINT.amountFieldKey,
    labelFieldKey: CHUNG_TU_DEFAULT_SHEET_PRINT.labelFieldKey,
    totalLabel: def.totalLabel ?? CHUNG_TU_DEFAULT_SHEET_PRINT.totalLabel,
  };
}

function detailTableHasColumnConfig(table) {
  if (!table || typeof table !== "object") return false;
  const mappings = Array.isArray(table.columnMappings) ? table.columnMappings : [];
  if (mappings.some((item) => String(item?.fieldKey ?? "").trim())) return true;
  const legacy = Array.isArray(table.columns) ? table.columns : [];
  return legacy.some((col) => String(col ?? "").trim());
}

function applyDefaultDetailTableOptions(fillRules, categoryKey) {
  const normalized = normalizeFillRulesV2(fillRules, "spreadsheet");
  const def = defaultDetailTableForCategory(categoryKey);
  if (!def) return normalized;
  const table = normalized.sheets?.detailTable;
  if (!table) {
    return normalized;
  }
  if (detailTableHasColumnConfig(table)) {
    normalized.sheets.detailTable = {
      ...table,
      rowHeightPt:
        Number.isFinite(Number(table.rowHeightPt)) && Number(table.rowHeightPt) > 0
          ? Number(table.rowHeightPt)
          : Number(def.rowHeightPt ?? CHUNG_TU_DEFAULT_SHEET_PRINT.rowHeightPt),
      amountFieldKey: table.amountFieldKey || def.amountFieldKey,
      labelFieldKey: table.labelFieldKey || def.labelFieldKey,
      totalLabel: table.totalLabel || def.totalLabel,
    };
    return normalized;
  }
  normalized.sheets.detailTable = {
    ...table,
    templateRow:
      Number.isFinite(Number(table.templateRow)) && Number(table.templateRow) >= 0
        ? Number(table.templateRow)
        : Number(def.templateRow ?? def.startRow),
    totalTemplateRow:
      Number.isFinite(Number(table.totalTemplateRow)) && Number(table.totalTemplateRow) >= 0
        ? Number(table.totalTemplateRow)
        : Number(def.totalTemplateRow ?? def.startRow + 1),
    rowHeightPt:
      Number.isFinite(Number(table.rowHeightPt)) && Number(table.rowHeightPt) > 0
        ? Number(table.rowHeightPt)
        : Number(def.rowHeightPt ?? CHUNG_TU_DEFAULT_SHEET_PRINT.rowHeightPt),
    amountFieldKey: table.amountFieldKey || def.amountFieldKey,
    labelFieldKey: table.labelFieldKey || def.labelFieldKey,
    totalLabel: table.totalLabel || def.totalLabel,
  };
  return normalized;
}

function suggestNamedRangeMappings(namedRangeItems, fieldKeys) {
  return (namedRangeItems ?? []).map((nr) => {
    const name = String(nr.name ?? "").trim();
    const match = matchFieldKeyForRangeName(name, fieldKeys);
    const templateRowIndex = Number(nr.grid?.startRowIndex);
    const templateColIndex = Number(nr.grid?.startColumnIndex);
    return {
      rangeName: name,
      sheetName: nr.sheetTitle ?? "",
      rule: "field",
      fieldKey: match ?? "",
      value: "",
      templateRowIndex: Number.isFinite(templateRowIndex) ? templateRowIndex : null,
      templateColIndex: Number.isFinite(templateColIndex) ? templateColIndex : null,
    };
  });
}

function mergeMissingNamedRangeMappings(fillRules, namedRangeItems, fieldKeys) {
  const normalized = normalizeFillRulesV2(fillRules, "spreadsheet");
  const existing = new Set(
    (normalized.sheets?.namedRanges ?? [])
      .map((item) => String(item.rangeName ?? "").trim())
      .filter(Boolean),
  );
  const additions = suggestNamedRangeMappings(
    (namedRangeItems ?? []).filter((item) => {
      const name = String(item.name ?? "").trim();
      return name && !existing.has(name);
    }),
    fieldKeys,
  );
  if (!additions.length) return normalized;
  return {
    ...normalized,
    sheets: {
      ...normalized.sheets,
      namedRanges: [...(normalized.sheets?.namedRanges ?? []), ...additions],
    },
  };
}

async function fetchSpreadsheetNamedRanges(oauth2Client, driveFileId, fileName) {
  const sheetsApi = createSheetsClient(oauth2Client);
  let res;
  try {
    res = await sheetsApi.spreadsheets.get({
      spreadsheetId: driveFileId,
      fields: "properties.title,namedRanges,sheets.properties(sheetId,title,hidden)",
    });
  } catch (error) {
    const status = error?.response?.status;
    const reason = error?.response?.data?.error?.errors?.[0]?.reason;
    if (status === 403 || reason === "PERMISSION_DENIED") {
      throw new AppError({
        message:
          "Không đọc được Google Sheets (kiểm tra liên kết Google Drive và quyền spreadsheets.readonly).",
        statusCode: 403,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (status === 404) {
      throw new AppError({
        message: "Không tìm thấy file Google Spreadsheet.",
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    throw error;
  }

  const sheetIdToTitle = new Map();
  for (const sh of res.data.sheets ?? []) {
    const sid = sh.properties?.sheetId;
    if (sid != null) {
      sheetIdToTitle.set(Number(sid), String(sh.properties?.title ?? ""));
    }
  }

  const items = (res.data.namedRanges ?? []).map((nr) => {
    const range = nr.range ?? {};
    const sheetId = range.sheetId != null ? Number(range.sheetId) : null;
    return {
      namedRangeId: nr.namedRangeId ?? null,
      name: nr.name ?? "",
      sheetId,
      sheetTitle:
        sheetId != null && !Number.isNaN(sheetId) ? (sheetIdToTitle.get(sheetId) ?? "") : "",
      grid: {
        startRowIndex: range.startRowIndex ?? null,
        endRowIndex: range.endRowIndex ?? null,
        startColumnIndex: range.startColumnIndex ?? null,
        endColumnIndex: range.endColumnIndex ?? null,
      },
    };
  });

  return {
    driveFileId,
    spreadsheetTitle: res.data.properties?.title ?? fileName ?? null,
    items,
  };
}

function sheetCellText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(sheetCellText).join("").trim();
  return String(value).trim();
}

function gridCellFormattedText(cell) {
  if (!cell) return "";
  const v = cell.formattedValue ?? cell.effectiveValue;
  if (v == null) return "";
  if (typeof v === "object" && v.stringValue != null) {
    return String(v.stringValue).trim();
  }
  return String(v).trim();
}

function buildMergeLookup(merges) {
  const masterAt = new Map();
  for (const merge of merges ?? []) {
    const startRow = merge.startRowIndex ?? 0;
    const endRow = merge.endRowIndex ?? startRow + 1;
    const startCol = merge.startColumnIndex ?? 0;
    const endCol = merge.endColumnIndex ?? startCol + 1;
    for (let row = startRow; row < endRow; row += 1) {
      for (let col = startCol; col < endCol; col += 1) {
        masterAt.set(`${row},${col}`, { row: startRow, col: startCol });
      }
    }
  }
  return masterAt;
}

function readGridCellText(gridData, mergeLookup, rowIndex, colIndex) {
  const master = mergeLookup.get(`${rowIndex},${colIndex}`);
  const masterRow = master?.row ?? rowIndex;
  const masterCol = master?.col ?? colIndex;
  const baseRow = gridData?.startRow ?? 0;
  const baseCol = gridData?.startColumn ?? 0;
  const relRow = masterRow - baseRow;
  const relCol = masterCol - baseCol;
  if (relRow < 0 || relCol < 0) return "";
  const cell = gridData?.rowData?.[relRow]?.values?.[relCol];
  return gridCellFormattedText(cell).slice(0, 120);
}

async function fetchSpreadsheetHeaderRows(oauth2Client, spreadsheetId, { sheetTitle = null } = {}) {
  const sheetsApi = createSheetsClient(oauth2Client);
  const metaRes = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,index),merges)",
  });
  const sheets = metaRes.data.sheets ?? [];
  const target =
    sheets.find((sh) => sheetTitle && String(sh.properties?.title ?? "") === String(sheetTitle)) ??
    sheets[0];
  const title = String(target?.properties?.title ?? "").trim() || "Sheet1";
  const safeSheet = `'${title.replace(/'/g, "''")}'`;
  const merges = target?.merges ?? [];
  const mergeLookup = buildMergeLookup(merges);

  let gridData = null;
  try {
    const res = await sheetsApi.spreadsheets.get({
      spreadsheetId,
      ranges: [`${safeSheet}!1:40`],
      includeGridData: true,
      fields:
        "sheets(data(startRow,startColumn,rowData(values(formattedValue,effectiveValue))),properties(title))",
    });
    const sheet =
      (res.data.sheets ?? []).find(
        (item) => String(item.properties?.title ?? "") === title,
      ) ?? res.data.sheets?.[0];
    gridData = sheet?.data?.[0] ?? null;
  } catch {
    return { sheetTitle: title, headerRows: [] };
  }

  if (!gridData?.rowData?.length) {
    return { sheetTitle: title, headerRows: [] };
  }

  const maxCol = 26;
  const headerRows = [];
  const baseRow = gridData.startRow ?? 0;
  const rowCount = gridData.rowData.length;

  for (let relRow = 0; relRow < rowCount; relRow += 1) {
    const rowIndex = baseRow + relRow;
    const cells = [];
    for (let colIndex = 0; colIndex < maxCol; colIndex += 1) {
      const label = readGridCellText(gridData, mergeLookup, rowIndex, colIndex);
      if (!label) continue;
      cells.push({
        col: colIndex,
        label,
        fieldKey: guessDetailFieldKeyFromLabel(label),
      });
    }
    if (cells.length >= 2) {
      headerRows.push({
        rowNumber: rowIndex,
        rowNumber1Based: rowIndex + 1,
        cells,
      });
    }
  }

  return {
    sheetTitle: title,
    headerRows: headerRows.slice(0, 12),
  };
}

function labelsByColFromHeaderPayload(headerPayload) {
  const map = new Map();
  for (const row of headerPayload?.headerRows ?? []) {
    for (const cell of row.cells ?? []) {
      const col = Number(cell.col);
      if (!Number.isFinite(col)) continue;
      const label = String(cell.label ?? "").trim();
      if (!label) continue;
      const prev = map.get(col);
      if (!prev || label.length > prev.length) {
        map.set(col, label);
      }
    }
  }
  return map;
}

function formatSlotMappingLabel(col, slotLabel, sheetLabel) {
  const letter = excelColumnLetter(col);
  if (sheetLabel && sheetLabel !== slotLabel) {
    return `${letter} — ${slotLabel} (${sheetLabel})`;
  }
  return `${letter} — ${slotLabel}`;
}

function inferDetailTableRowsFromHeader(headerPayload, categoryKey, def) {
  const sttHeaderRow = headerPayload?.headerRows?.find((row) =>
    row.cells?.some((cell) => guessDetailFieldKeyFromLabel(cell.label) === "stt"),
  );
  const headerRow = sttHeaderRow?.rowNumber ?? null;
  let startRow = Number(def?.startRow ?? 8);
  if (headerRow != null) {
    const offset =
      String(categoryKey ?? "").trim() === CHUNG_TU_CATEGORY_KEYS.PHIEU_NHAP_KHO ? 3 : 1;
    startRow = headerRow + offset;
  }
  const totalTemplateRow = Number(def?.totalTemplateRow ?? startRow + 1);
  return {
    headerRow,
    startRow,
    templateRow: startRow,
    totalTemplateRow,
  };
}

function suggestDetailTableFromHeaderRows(headerPayload, categoryKey) {
  const slots = getSuggestedColumnSlotsForCategory(categoryKey);
  const def = defaultDetailTableForCategory(categoryKey);
  const labelsByCol = labelsByColFromHeaderPayload(headerPayload);
  const rowLayout = inferDetailTableRowsFromHeader(headerPayload, categoryKey, def);

  if (slots.length) {
    const columnMappings = slots.map((slot) => {
      const sheetLabel = labelsByCol.get(slot.col) ?? "";
      return {
        col: slot.col,
        label: formatSlotMappingLabel(slot.col, slot.label, sheetLabel),
        fieldKey: slot.defaultFieldKey ?? "",
      };
    });
    return {
      sheetName: headerPayload?.sheetTitle || def?.sheetName || "",
      headerRow: rowLayout.headerRow,
      startRow: rowLayout.startRow,
      startCol: Math.min(...slots.map((s) => s.col)),
      templateRow: rowLayout.templateRow,
      totalTemplateRow: rowLayout.totalTemplateRow,
      columnMappings,
      columns: columnMappings.map((item) => item.fieldKey).filter(Boolean),
      amountFieldKey: CHUNG_TU_DEFAULT_SHEET_PRINT.amountFieldKey,
      labelFieldKey: CHUNG_TU_DEFAULT_SHEET_PRINT.labelFieldKey,
      totalLabel: CHUNG_TU_DEFAULT_SHEET_PRINT.totalLabel,
    };
  }

  const rows = headerPayload?.headerRows ?? [];
  if (!rows.length) return null;

  let best = rows[0];
  let bestScore = -1;
  for (const row of rows) {
    const score = row.cells.filter((cell) => cell.fieldKey).length;
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }

  const columnMappings = best.cells
    .filter((cell) => cell.label)
    .map((cell) => ({
      col: cell.col,
      label: `${excelColumnLetter(cell.col)} — ${cell.label}`,
      fieldKey: cell.fieldKey || "",
    }));

  if (!columnMappings.length) return null;

  const startCol = Math.min(...columnMappings.map((item) => item.col));
  const dataStartRow = Number(def?.startRow ?? 8);
  const totalTemplateRow = Number(def?.totalTemplateRow ?? dataStartRow + 1);

  return {
    sheetName: headerPayload.sheetTitle || def?.sheetName || "",
    headerRow: best.rowNumber,
    startRow: dataStartRow,
    startCol,
    templateRow: dataStartRow,
    totalTemplateRow,
    columnMappings,
    columns: columnMappings.map((item) => item.fieldKey).filter(Boolean),
    amountFieldKey: CHUNG_TU_DEFAULT_SHEET_PRINT.amountFieldKey,
    labelFieldKey: CHUNG_TU_DEFAULT_SHEET_PRINT.labelFieldKey,
    totalLabel: CHUNG_TU_DEFAULT_SHEET_PRINT.totalLabel,
  };
}

function mergeSuggestedDetailTable(fillRules, suggested, categoryKey) {
  if (!suggested) return fillRules;
  const slots = getSuggestedColumnSlotsForCategory(categoryKey);
  const current = fillRules.sheets?.detailTable;
  const hasMappings =
    Array.isArray(current?.columnMappings) && current.columnMappings.length > 0;
  const hasLegacyColumns = Array.isArray(current?.columns) && current.columns.length > 0;

  if (slots.length && (hasMappings || hasLegacyColumns || current)) {
    const savedMappings = hasMappings
      ? current.columnMappings
      : resolveDetailColumnMappings(current ?? suggested, suggested?.startCol ?? 0);
    const incomplete = isIncompleteColumnSlotConfig(savedMappings, slots);
    const mergedMappings = mergeColumnMappingsWithSuggestedSlots(savedMappings, slots);
    const rowFromSuggested =
      incomplete && suggested
        ? {
            headerRow: suggested.headerRow ?? current?.headerRow ?? null,
            startRow: suggested.startRow ?? current?.startRow,
            templateRow: suggested.templateRow ?? current?.templateRow,
            totalTemplateRow: suggested.totalTemplateRow ?? current?.totalTemplateRow,
            sheetName: suggested.sheetName || current?.sheetName || "",
            startCol: Math.min(...slots.map((slot) => Number(slot.col))),
          }
        : {};

    return {
      ...fillRules,
      sheets: {
        ...fillRules.sheets,
        detailTable: {
          ...suggested,
          ...current,
          ...rowFromSuggested,
          columnMappings: mergedMappings,
          columns: mergedMappings.map((item) => item.fieldKey).filter(Boolean),
        },
      },
    };
  }

  if (hasMappings || hasLegacyColumns) {
    return {
      ...fillRules,
      sheets: {
        ...fillRules.sheets,
        detailTable: {
          ...suggested,
          ...current,
          columnMappings: hasMappings
            ? current.columnMappings
            : resolveDetailColumnMappings(current ?? suggested, suggested.startCol),
        },
      },
    };
  }
  return {
    ...fillRules,
    sheets: {
      ...fillRules.sheets,
      detailTable: suggested,
    },
  };
}

async function enrichFillRulesWithSuggestedDetailTable(
  fillRules,
  oauth2Client,
  spreadsheetId,
  categoryKey,
) {
  const def = defaultDetailTableForCategory(categoryKey);
  const sheetTitle =
    fillRules?.sheets?.detailTable?.sheetName ||
    def?.sheetName ||
    null;
  const sheetHeadersPayload = await fetchSpreadsheetHeaderRows(oauth2Client, spreadsheetId, {
    sheetTitle,
  });
  const suggestedDetailTable = suggestDetailTableFromHeaderRows(sheetHeadersPayload, categoryKey);
  return mergeSuggestedDetailTable(fillRules, suggestedDetailTable, categoryKey);
}

function buildNamedRangeItemsFromSpreadsheetMeta(meta) {
  const sheetIdToTitle = meta?.sheetIdToTitle ?? new Map();
  return (meta?.namedRanges ?? [])
    .map((nr) => {
      const range = nr.range ?? {};
      const sheetId = range.sheetId != null ? Number(range.sheetId) : null;
      return {
        namedRangeId: nr.namedRangeId ?? null,
        name: String(nr.name ?? "").trim(),
        sheetId,
        sheetTitle:
          sheetId != null && !Number.isNaN(sheetId)
            ? (sheetIdToTitle.get(sheetId) ?? "")
            : "",
        grid: {
          startRowIndex: range.startRowIndex ?? null,
          endRowIndex: range.endRowIndex ?? null,
          startColumnIndex: range.startColumnIndex ?? null,
          endColumnIndex: range.endColumnIndex ?? null,
        },
      };
    })
    .filter((item) => item.name);
}

/** Chỉ map named range → field tự động (ngày, số, quyển số, tiền bằng chữ). Bỏ qua chữ ký/header. */
export function buildDerivedNamedRangeMappings(spreadsheetMeta, categoryKey) {
  const namedRangeItems = buildNamedRangeItemsFromSpreadsheetMeta(spreadsheetMeta);
  const derivedSet = getDerivedNamedRangeSetForCategory(categoryKey);
  const derivedFieldKeys = [...derivedSet];
  return suggestNamedRangeMappings(namedRangeItems, derivedFieldKeys).filter(
    (item) => item.fieldKey && derivedSet.has(item.fieldKey),
  );
}

/** Bổ sung map named range từ metadata sheet output — chỉ field tự động, không dùng map cũ. */
export function enrichFillRulesWithSpreadsheetMeta(fillRules, spreadsheetMeta, categoryKey) {
  const normalized = normalizeFillRulesV2(fillRules, "spreadsheet");
  const savedByName = new Map(
    (normalized.sheets?.namedRanges ?? [])
      .map((nr) => [String(nr.rangeName ?? "").trim(), nr])
      .filter(([name]) => name),
  );
  const namedRanges = buildDerivedNamedRangeMappings(spreadsheetMeta, categoryKey).map((nr) => {
    const saved = savedByName.get(String(nr.rangeName ?? "").trim());
    return {
      ...nr,
      templateRowIndex:
        Number.isFinite(Number(saved?.templateRowIndex)) ? Number(saved.templateRowIndex) : nr.templateRowIndex,
      templateColIndex:
        Number.isFinite(Number(saved?.templateColIndex)) ? Number(saved.templateColIndex) : nr.templateColIndex,
    };
  });

  return applyDefaultDetailTableOptions(
    {
      ...normalized,
      sheets: {
        ...normalized.sheets,
        namedRanges,
      },
    },
    categoryKey,
  );
}
export async function loadFillRulesForCategoryTemplate(
  templateDriveFileId,
  categoryKey,
  { userId, skipTemplateNamedRangeFetch = false, requireSavedDetailTable = false } = {},
) {
  const registry = getContextFieldRegistryForCategory(categoryKey);
  const fieldKeys = buildKnownFieldKeys(registry, categoryKey);
  let namedRangesPayload = null;
  async function fetchTemplateNamedRangesForMerge() {
    if (skipTemplateNamedRangeFetch) {
      return { items: [] };
    }
    if (namedRangesPayload) return namedRangesPayload;
    const { oauth2Client, meta } = await assertTemplateInCategoryFolder({
      userId,
      categoryKey,
      driveFileId: templateDriveFileId,
    });
    if (meta.mimeType !== GOOGLE_SHEET_MIME) {
      namedRangesPayload = { items: [] };
      return namedRangesPayload;
    }
    namedRangesPayload = await fetchSpreadsheetNamedRanges(
      oauth2Client,
      templateDriveFileId,
      meta.name,
    );
    return namedRangesPayload;
  }

  const cfg = await prisma.chungTuTemplateFillConfig.findUnique({
    where: {
      categoryKey_driveFileId: {
        categoryKey,
        driveFileId: templateDriveFileId,
      },
    },
    select: { fillRulesJson: true },
  });
  if (cfg?.fillRulesJson) {
    const payload = await fetchTemplateNamedRangesForMerge();
    let merged = skipTemplateNamedRangeFetch
      ? normalizeFillRulesV2(cfg.fillRulesJson, "spreadsheet")
      : mergeMissingNamedRangeMappings(cfg.fillRulesJson, payload.items, fieldKeys);
    merged = applyDefaultDetailTableOptions(merged, categoryKey);
    if (!skipTemplateNamedRangeFetch) {
      const { oauth2Client } = await assertTemplateInCategoryFolder({
        userId,
        categoryKey,
        driveFileId: templateDriveFileId,
      });
      merged = await enrichFillRulesWithSuggestedDetailTable(
        merged,
        oauth2Client,
        templateDriveFileId,
        categoryKey,
      );
    }
    return merged;
  }

  const catalog = await prisma.chungTuDriveTemplateLink.findFirst({
    where: { driveFileId: templateDriveFileId, categoryKey, isActive: true },
    select: { fillRulesJson: true },
  });
  if (catalog?.fillRulesJson) {
    const normalizedCatalog = normalizeFillRulesV2(catalog.fillRulesJson, "spreadsheet");
    if (detailTableHasColumnConfig(normalizedCatalog.sheets?.detailTable)) {
      const payload = await fetchTemplateNamedRangesForMerge();
      let merged = skipTemplateNamedRangeFetch
        ? normalizedCatalog
        : mergeMissingNamedRangeMappings(catalog.fillRulesJson, payload.items, fieldKeys);
      merged = applyDefaultDetailTableOptions(merged, categoryKey);
      if (!skipTemplateNamedRangeFetch) {
        const { oauth2Client } = await assertTemplateInCategoryFolder({
          userId,
          categoryKey,
          driveFileId: templateDriveFileId,
        });
        merged = await enrichFillRulesWithSuggestedDetailTable(
          merged,
          oauth2Client,
          templateDriveFileId,
          categoryKey,
        );
      }
      return merged;
    }
  }

  if (requireSavedDetailTable) {
    throw new AppError({
      message:
        "Mẫu Google Sheets này chưa có cấu hình map bảng chi tiết. Mở «Map dữ liệu → ô mẫu» trên đúng mẫu đang dùng, cấu hình cột/dòng rồi bấm «Lưu map».",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (skipTemplateNamedRangeFetch) {
    const fillRules = normalizeFillRulesV2(null, "spreadsheet");
    return applyDefaultDetailTableOptions(fillRules, categoryKey);
  }

  const fillRules = normalizeFillRulesV2(null, "spreadsheet");
  const payload = await fetchTemplateNamedRangesForMerge();
  fillRules.sheets.namedRanges = suggestNamedRangeMappings(payload.items, fieldKeys);
  const { oauth2Client } = await assertTemplateInCategoryFolder({
    userId,
    categoryKey,
    driveFileId: templateDriveFileId,
  });
  const def = defaultDetailTableForCategory(categoryKey);
  const sheetTitle =
    fillRules.sheets?.detailTable?.sheetName || def?.sheetName || null;
  const sheetHeadersPayload = await fetchSpreadsheetHeaderRows(oauth2Client, templateDriveFileId, {
    sheetTitle,
  });
  const suggestedDetailTable = suggestDetailTableFromHeaderRows(sheetHeadersPayload, categoryKey);
  if (suggestedDetailTable) {
    fillRules.sheets.detailTable = suggestedDetailTable;
  }
  return applyDefaultDetailTableOptions(fillRules, categoryKey);
}

export async function getCategoryTemplateFillMapping({ userId, categoryKey, driveFileId }) {
  const { oauth2Client, meta } = await assertTemplateInCategoryFolder({
    userId,
    categoryKey,
    driveFileId,
  });
  if (meta.mimeType !== GOOGLE_SHEET_MIME) {
    throw new AppError({
      message: "Chỉ map dữ liệu cho mẫu Google Sheets.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const registry = getContextFieldRegistryForCategory(categoryKey);
  const fieldKeys = buildKnownFieldKeys(registry, categoryKey);

  const saved = await prisma.chungTuTemplateFillConfig.findUnique({
    where: {
      categoryKey_driveFileId: { categoryKey, driveFileId },
    },
  });

  const namedRangesPayload = await fetchSpreadsheetNamedRanges(
    oauth2Client,
    driveFileId,
    meta.name,
  );
  const def = defaultDetailTableForCategory(categoryKey);
  const preferredSheetName =
    saved?.fillRulesJson?.sheets?.detailTable?.sheetName || def?.sheetName || null;
  const sheetHeadersPayload = await fetchSpreadsheetHeaderRows(oauth2Client, driveFileId, {
    sheetTitle: preferredSheetName,
  });
  const suggestedDetailTable = suggestDetailTableFromHeaderRows(sheetHeadersPayload, categoryKey);

  let fillRules;
  const hasSavedConfig = Boolean(saved?.fillRulesJson);
  if (hasSavedConfig) {
    fillRules = applyDefaultDetailTableOptions(
      mergeMissingNamedRangeMappings(saved.fillRulesJson, namedRangesPayload.items, fieldKeys),
      categoryKey,
    );
  } else {
    fillRules = normalizeFillRulesV2(
      {
        version: 2,
        workspaceKind: "spreadsheet",
        sheets: {
          namedRanges: suggestNamedRangeMappings(namedRangesPayload.items, fieldKeys),
          detailTable: suggestedDetailTable ?? defaultDetailTableForCategory(categoryKey),
        },
      },
      "spreadsheet",
    );
  }
  fillRules = mergeSuggestedDetailTable(fillRules, suggestedDetailTable, categoryKey);

  const suggestedColumnSlots = getSuggestedColumnSlotsForCategory(categoryKey).map((slot) => ({
    col: slot.col,
    label: formatSlotMappingLabel(
      slot.col,
      slot.label,
      labelsByColFromHeaderPayload(sheetHeadersPayload).get(slot.col) ?? "",
    ),
    defaultFieldKey: slot.defaultFieldKey ?? "",
  }));

  return {
    categoryKey,
    driveFileId,
    driveFileName: meta.name ?? null,
    webViewLink: meta.webViewLink ?? null,
    hasSavedConfig,
    fillRules,
    suggestedColumnSlots,
    namedRanges: namedRangesPayload.items,
    sheetHeaders: sheetHeadersPayload,
    detailFieldCatalog: [...CHUNG_TU_DETAIL_FIELD_CATALOG],
    fieldRegistry: {
      ...registry,
      derivedFields: buildContextDerivedFieldsForCategory(categoryKey),
      detailFields: [...CHUNG_TU_DETAIL_FIELD_CATALOG],
    },
  };
}

export async function putCategoryTemplateFillMapping({
  userId,
  categoryKey,
  driveFileId,
  fillRules,
  updatedById,
}) {
  const { meta } = await assertTemplateInCategoryFolder({ userId, categoryKey, driveFileId });
  if (meta.mimeType !== GOOGLE_SHEET_MIME) {
    throw new AppError({
      message: "Chỉ lưu map cho mẫu Google Sheets.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  assertFillRulesObject(fillRules);
  const normalized = normalizeFillRulesV2(fillRules, "spreadsheet");

  const row = await prisma.chungTuTemplateFillConfig.upsert({
    where: {
      categoryKey_driveFileId: { categoryKey, driveFileId },
    },
    create: {
      categoryKey,
      driveFileId,
      templateName: meta.name ?? null,
      fillRulesJson: normalized,
      updatedById: updatedById ?? null,
    },
    update: {
      templateName: meta.name ?? null,
      fillRulesJson: normalized,
      updatedById: updatedById ?? null,
    },
  });

  return {
    categoryKey,
    driveFileId,
    driveFileName: meta.name ?? null,
    hasSavedConfig: true,
    fillRules: normalizeFillRulesV2(row.fillRulesJson, "spreadsheet"),
    updatedAt: row.updatedAt,
  };
}

export async function listCategoryTemplateNamedRanges({ userId, categoryKey, driveFileId }) {
  const { oauth2Client, meta } = await assertTemplateInCategoryFolder({
    userId,
    categoryKey,
    driveFileId,
  });
  if (meta.mimeType !== GOOGLE_SHEET_MIME) {
    throw new AppError({
      message: "Chỉ đọc Named range từ Google Sheets.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return fetchSpreadsheetNamedRanges(oauth2Client, driveFileId, meta.name);
}
