import { google } from "googleapis";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { CHUNG_TU_DEFAULT_SHEET_TABLE } from "./chung-tu-category.constants.js";
import { loadFillRulesForCategoryTemplate } from "./chung-tu-template-fill-config.service.js";
import { resolveTemplateSheetTitle } from "./chung-tu-monthly-sheets.js";
import { buildChungTuSheetPrintRows } from "./chung-tu-print-pagination.js";

const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const DEFAULT_DETAIL_TABLE_CLEAR_ROWS = 1000;
const SKIPPED_NAMED_RANGE_FIELD_KEYS_BY_CATEGORY = Object.freeze({
  "bang-ke-mua-hang": new Set(["hoTenNguoiMua", "mauSo"]),
});

function contextFieldValue(context, fieldKey) {
  if (!fieldKey) return "";
  const v = context[fieldKey];
  if (v == null) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return String(v);
}

function colLetter(index) {
  let n = index;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

async function loadFillRulesForTemplate(templateDriveFileId, categoryKey) {
  return loadFillRulesForCategoryTemplate(templateDriveFileId, categoryKey);
}

async function fetchSpreadsheetSheetTitles(sheetsApi, spreadsheetId) {
  const sheets = await fetchSpreadsheetSheets(sheetsApi, spreadsheetId);
  const visible = sheets.filter((sh) => !sh.hidden).map((sh) => sh.title);
  return visible.length ? visible : sheets.map((sh) => sh.title);
}

async function fetchSpreadsheetSheets(sheetsApi, spreadsheetId) {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,hidden,index)",
  });
  const sheets = [];
  for (const sh of meta.data.sheets ?? []) {
    const sheetId = sh.properties?.sheetId;
    const title = String(sh.properties?.title ?? "").trim();
    if (sheetId == null || !title) continue;
    sheets.push({
      sheetId: Number(sheetId),
      title,
      hidden: Boolean(sh.properties?.hidden),
      index: Number(sh.properties?.index ?? 0),
    });
  }
  return sheets;
}

/** Ưu tiên sheet cấu hình nếu tồn tại; không thì sheet xuất hiện nhiều nhất trong named ranges; cuối cùng là sheet đầu tiên. */
function resolveDetailTableSheetTitle(configuredName, availableTitles, namedRangeSheetTitles) {
  const available = availableTitles.filter(Boolean);
  const configured = String(configuredName ?? "").trim();
  if (configured && configured !== "Sheet1" && available.includes(configured)) {
    return configured;
  }
  const counts = new Map();
  for (const name of namedRangeSheetTitles) {
    const n = String(name ?? "").trim();
    if (!n || !available.includes(n)) continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  if (best) return best;
  if (configured && available.includes(configured)) return configured;
  return available[0] ?? configured ?? "Sheet1";
}

async function resolveNamedRangeBounds(sheetsApi, spreadsheetId, rangeName) {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title),namedRanges",
  });
  const sheetIdToTitle = new Map();
  for (const sh of meta.data.sheets ?? []) {
    const sid = sh.properties?.sheetId;
    if (sid != null) sheetIdToTitle.set(Number(sid), String(sh.properties?.title ?? ""));
  }
  const nr = (meta.data.namedRanges ?? []).find((x) => x.name === rangeName);
  if (!nr?.range) {
    return null;
  }
  const r = nr.range;
  const sheetTitle = sheetIdToTitle.get(Number(r.sheetId)) ?? "Sheet1";
  const safeSheet = `'${sheetTitle.replace(/'/g, "''")}'`;
  const startRow = Number(r.startRowIndex ?? 0);
  const endRow = Number(r.endRowIndex ?? startRow + 1);
  const startCol = Number(r.startColumnIndex ?? 0);
  const endCol = Number(r.endColumnIndex ?? startCol + 1);
  const rowCount = Math.max(1, endRow - startRow);
  const colCount = Math.max(1, endCol - startCol);
  const startA1 = `${colLetter(startCol)}${startRow + 1}`;
  const endA1 = `${colLetter(startCol + colCount - 1)}${startRow + rowCount}`;
  const a1Range = `${safeSheet}!${startA1}:${endA1}`;
  const a1SingleCell = `${safeSheet}!${startA1}`;
  return { sheetTitle, startRow, startCol, rowCount, colCount, a1Range, a1SingleCell };
}

function expandTextToCharGrid(text, boxCount) {
  const chars = [...String(text ?? "").trim().normalize("NFC")];
  const row = [];
  for (let i = 0; i < boxCount; i += 1) {
    row.push(chars[i] ?? "");
  }
  return row;
}

function buildTableRangeA1({ sheetName, startRow, startCol, rowCount, colCount }) {
  const safeSheet = `'${String(sheetName || "Sheet1").replace(/'/g, "''")}'`;
  const start = `${colLetter(startCol)}${startRow + 1}`;
  const end = `${colLetter(startCol + colCount - 1)}${startRow + rowCount}`;
  return `${safeSheet}!${start}:${end}`;
}

function buildRangeFromBounds({ sheetName, startRow, startCol, rowCount, colCount }) {
  const safeSheet = `'${String(sheetName || "Sheet1").replace(/'/g, "''")}'`;
  const start = `${colLetter(startCol)}${startRow + 1}`;
  const end = `${colLetter(startCol + colCount - 1)}${startRow + rowCount}`;
  return `${safeSheet}!${start}:${end}`;
}

function buildSingleCellFromBounds({ sheetName, startRow, startCol }) {
  const safeSheet = `'${String(sheetName || "Sheet1").replace(/'/g, "''")}'`;
  return `${safeSheet}!${colLetter(startCol)}${startRow + 1}`;
}

function detailRowToCells(row, columns) {
  return columns.map((col) => {
    const v = row[col];
    if (v == null) return "";
    return v;
  });
}

function buildDetailTableValues({ detailRows, columns }) {
  return detailRows.map((row) => detailRowToCells(row, columns));
}

function shouldSkipNamedRangeUpdate(categoryKey, rule) {
  const skipped = SKIPPED_NAMED_RANGE_FIELD_KEYS_BY_CATEGORY[categoryKey];
  if (rule?.rule === "static") return false;
  const fieldKey = String(rule?.fieldKey ?? "").trim();
  if (!fieldKey) return true;
  if (!skipped) return false;
  const rangeName = String(rule?.rangeName ?? "").trim();
  return skipped.has(fieldKey) || skipped.has(rangeName);
}

async function ensureMonthlySheets({ sheetsApi, spreadsheetId, sheetNames }) {
  const wanted = (sheetNames ?? []).map((name) => String(name ?? "").trim()).filter(Boolean);
  if (!wanted.length) return;

  let sheets = await fetchSpreadsheetSheets(sheetsApi, spreadsheetId);
  const existingTitles = new Set(sheets.map((sh) => sh.title));
  const sourceTitle = resolveTemplateSheetTitle(sheets.map((sh) => sh.title));
  const sourceSheet = sheets.find((sh) => sh.title === sourceTitle);
  if (!sourceSheet) {
    throw new AppError({
      message: "Không tìm thấy sheet mẫu để nhân bản trong Google Sheets.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const requests = [];
  for (const [index, sheetName] of wanted.entries()) {
    if (existingTitles.has(sheetName)) continue;
    requests.push({
      duplicateSheet: {
        sourceSheetId: sourceSheet.sheetId,
        insertSheetIndex: index + 1,
        newSheetName: sheetName,
      },
    });
    existingTitles.add(sheetName);
  }
  if (!requests.length) return;

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

async function buildNamedRangeBounds(sheetsApi, spreadsheetId, namedRanges) {
  const bounds = new Map();
  for (const nr of namedRanges ?? []) {
    if (!nr.rangeName || bounds.has(nr.rangeName)) continue;
    const b = await resolveNamedRangeBounds(sheetsApi, spreadsheetId, nr.rangeName);
    if (b) bounds.set(nr.rangeName, b);
  }
  return bounds;
}

function pushContextNamedRangeUpdates({ data, fillRules, namedRangeBounds, context, sheetName, categoryKey }) {
  for (const nr of fillRules.sheets?.namedRanges ?? []) {
    if (!nr.rangeName) continue;
    if (shouldSkipNamedRangeUpdate(categoryKey, nr)) continue;
    const bounds = namedRangeBounds.get(nr.rangeName);
    if (!bounds) continue;
    const targetSheetName = sheetName || bounds.sheetTitle;

    if (nr.rule === "charGrid") {
      const raw =
        nr.rule === "static" ? String(nr.value ?? "") : contextFieldValue(context, nr.fieldKey);
      data.push({
        range: buildRangeFromBounds({ ...bounds, sheetName: targetSheetName }),
        values: [expandTextToCharGrid(raw, bounds.colCount)],
      });
      continue;
    }

    const value =
      nr.rule === "static" ? String(nr.value ?? "") : contextFieldValue(context, nr.fieldKey);
    data.push({
      range: buildSingleCellFromBounds({ ...bounds, sheetName: targetSheetName }),
      values: [[value]],
    });
  }
}

function pushContextDetailTableUpdate({
  data,
  clearRanges,
  fillRules,
  categoryKey,
  context,
  sheetName,
  sheetTitles,
  namedRangeSheetTitles,
  clearRowCount,
}) {
  const defaultTable = CHUNG_TU_DEFAULT_SHEET_TABLE[categoryKey] ?? null;
  const tableCfgRaw = fillRules.sheets?.detailTable ?? defaultTable;
  const detailRows = Array.isArray(context.detailRows) ? context.detailRows : [];
  if (!tableCfgRaw) return;

  const columns =
    tableCfgRaw.columns ?? (Array.isArray(defaultTable?.columns) ? defaultTable.columns : []);
  const sheetTitle =
    sheetName ||
    resolveDetailTableSheetTitle(tableCfgRaw.sheetName, sheetTitles, namedRangeSheetTitles);
  const startRow = tableCfgRaw.startRow ?? defaultTable?.startRow ?? 8;
  const startCol = tableCfgRaw.startCol ?? defaultTable?.startCol ?? 0;
  const pageRowsFirst =
    Number.isFinite(Number(tableCfgRaw.pageRowsFirst)) && Number(tableCfgRaw.pageRowsFirst) > 0
      ? Number(tableCfgRaw.pageRowsFirst)
      : 0;
  const pageRowsNext =
    Number.isFinite(Number(tableCfgRaw.pageRowsNext)) && Number(tableCfgRaw.pageRowsNext) > 0
      ? Number(tableCfgRaw.pageRowsNext)
      : 0;
  const useSheetCarryRows = pageRowsFirst > 0 && pageRowsNext > 0;
  const values = useSheetCarryRows
    ? buildChungTuSheetPrintRows({
        detailRows,
        columns,
        pageRowsFirst,
        pageRowsNext,
        amountFieldKey: tableCfgRaw.amountFieldKey || "thanhTien",
        labelFieldKey: tableCfgRaw.labelFieldKey || "tenHang",
        carryInLabel: tableCfgRaw.carryInLabel || "Mang sang",
        carryOutLabel: tableCfgRaw.carryOutLabel || "Cộng sang trang",
      })
    : buildDetailTableValues({
        detailRows,
        columns,
      });
  const clearRows = Math.max(
    Number(clearRowCount) || DEFAULT_DETAIL_TABLE_CLEAR_ROWS,
    values.length || detailRows.length,
  );

  if (clearRanges && clearRows > 0 && columns.length > 0) {
    clearRanges.push(
      buildTableRangeA1({
        sheetName: sheetTitle,
        startRow,
        startCol,
        rowCount: clearRows,
        colCount: columns.length,
      }),
    );
  }
  if (detailRows.length <= 0) return;

  const range = buildTableRangeA1({
    sheetName: sheetTitle,
    startRow,
    startCol,
    rowCount: values.length,
    colCount: columns.length,
  });
  data.push({ range, values });
}

export async function syncSpreadsheetFromContext({
  oauth2Client,
  spreadsheetId,
  templateDriveFileId,
  categoryKey,
  context,
}) {
  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const fileMeta = await drive.files.get({
    fileId: spreadsheetId,
    fields: "mimeType",
    supportsAllDrives: false,
  });
  if (fileMeta.data.mimeType !== GOOGLE_SHEET_MIME) {
    throw new AppError({
      message: "Chứng từ output phải là Google Sheets.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const fillRules = await loadFillRulesForTemplate(templateDriveFileId, categoryKey);
  const sheetsApi = google.sheets({ version: "v4", auth: oauth2Client });
  const sheetContexts = Array.isArray(context.sheetContexts) ? context.sheetContexts : [];
  if (sheetContexts.length > 0) {
    const sheetNames = sheetContexts.map((ctx) => ctx.sheetName).filter(Boolean);
    await ensureMonthlySheets({ sheetsApi, spreadsheetId, sheetNames });
    const namedRangeBounds = await buildNamedRangeBounds(
      sheetsApi,
      spreadsheetId,
      fillRules.sheets?.namedRanges,
    );
    const data = [];
    const clearRanges = [];
    for (const ctx of sheetContexts) {
      const sheetName = ctx.sheetName;
      pushContextNamedRangeUpdates({
        data,
        fillRules,
        namedRangeBounds,
        context: ctx,
        sheetName,
        categoryKey,
      });
      pushContextDetailTableUpdate({
        data,
        clearRanges,
        fillRules,
        categoryKey,
        context: ctx,
        sheetName,
        sheetTitles: sheetNames,
        namedRangeSheetTitles: sheetNames,
        clearRowCount: DEFAULT_DETAIL_TABLE_CLEAR_ROWS,
      });
    }
    return commitSheetValueUpdates({ sheetsApi, spreadsheetId, data, clearRanges });
  }

  const sheetTitles = await fetchSpreadsheetSheetTitles(sheetsApi, spreadsheetId);
  const namedRangeSheetTitles = [];
  const data = [];
  const clearRanges = [];
  const namedRangeBounds = await buildNamedRangeBounds(
    sheetsApi,
    spreadsheetId,
    fillRules.sheets?.namedRanges,
  );

  for (const nr of fillRules.sheets?.namedRanges ?? []) {
    if (!nr.rangeName) continue;
    if (shouldSkipNamedRangeUpdate(categoryKey, nr)) continue;
    const bounds = namedRangeBounds.get(nr.rangeName);
    if (!bounds) continue;
    if (bounds.sheetTitle) namedRangeSheetTitles.push(bounds.sheetTitle);

    if (nr.rule === "charGrid") {
      const raw =
        nr.rule === "static" ? String(nr.value ?? "") : contextFieldValue(context, nr.fieldKey);
      data.push({
        range: bounds.a1Range,
        values: [expandTextToCharGrid(raw, bounds.colCount)],
      });
      continue;
    }

    const value =
      nr.rule === "static" ? String(nr.value ?? "") : contextFieldValue(context, nr.fieldKey);
    data.push({
      range: bounds.a1SingleCell,
      values: [[value]],
    });
  }

  pushContextDetailTableUpdate({
    data,
    clearRanges,
    fillRules,
    categoryKey,
    context,
    sheetTitles,
    namedRangeSheetTitles,
  });

  return commitSheetValueUpdates({ sheetsApi, spreadsheetId, data, clearRanges });
}

async function commitSheetValueUpdates({ sheetsApi, spreadsheetId, data, clearRanges = [] }) {
  if (data.length === 0 && clearRanges.length === 0) {
    return { updatedRanges: 0 };
  }

  try {
    if (clearRanges.length > 0) {
      await sheetsApi.spreadsheets.values.batchClear({
        spreadsheetId,
        requestBody: { ranges: clearRanges },
      });
    }
    if (data.length > 0) {
      await sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data,
        },
      });
    }
  } catch (error) {
    const msg =
      error?.response?.data?.error?.message ||
      error?.errors?.[0]?.message ||
      error?.message ||
      "Không ghi được dữ liệu lên Google Sheets.";
    throw new AppError({
      message: `Đồng bộ Google Sheets thất bại: ${msg}`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  return { updatedRanges: data.length, clearedRanges: clearRanges.length };
}
