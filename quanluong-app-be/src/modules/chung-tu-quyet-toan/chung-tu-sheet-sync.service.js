import { google } from "googleapis";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { CHUNG_TU_DEFAULT_SHEET_TABLE } from "./chung-tu-category.constants.js";
import { loadFillRulesForCategoryTemplate } from "./chung-tu-template-fill-config.service.js";
import { resolveTemplateSheetTitle } from "./chung-tu-monthly-sheets.js";
import {
  buildAutoResizeRowsRequest,
  buildPerRowHeightUpdateRequests,
  buildPerRowHeightUpdateRequestsFromPlacements,
  buildSheetPrintOutput,
  buildWrapTextRepeatCellRequest,
  fetchSheetTemplateColumnMeta,
} from "./chung-tu-sheet-print-pagination.js";

const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const DEFAULT_DETAIL_TABLE_CLEAR_ROWS = 1000;
const SPREADSHEET_META_CACHE_TTL_MS = 2 * 60 * 1000;
const DETAIL_TABLE_COLUMN_META_CACHE_KEY = "__detail_table_column_meta__";
const SKIPPED_NAMED_RANGE_FIELD_KEYS_BY_CATEGORY = Object.freeze({
  "bang-ke-mua-hang": new Set(["hoTenNguoiMua", "mauSo"]),
});

/** @type {Map<string, { expiresAt: number, data: object }>} */
const spreadsheetMetaCache = new Map();

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
  return loadFillRulesForCategoryTemplate(templateDriveFileId, categoryKey, {
    skipTemplateNamedRangeFetch: true,
  });
}

function invalidateSpreadsheetMetaCache(spreadsheetId) {
  if (spreadsheetId) spreadsheetMetaCache.delete(String(spreadsheetId));
}

function parseSpreadsheetMetaResponse(raw) {
  const sheets = [];
  const titleToSheetId = new Map();
  const sheetIdToTitle = new Map();
  for (const sh of raw?.sheets ?? []) {
    const sheetId = sh.properties?.sheetId;
    const title = String(sh.properties?.title ?? "").trim();
    if (sheetId == null || !title) continue;
    const entry = {
      sheetId: Number(sheetId),
      title,
      hidden: Boolean(sh.properties?.hidden),
      index: Number(sh.properties?.index ?? 0),
    };
    sheets.push(entry);
    titleToSheetId.set(title, entry.sheetId);
    sheetIdToTitle.set(entry.sheetId, title);
  }
  return {
    sheets,
    titleToSheetId,
    sheetIdToTitle,
    namedRanges: raw?.namedRanges ?? [],
  };
}

async function fetchSpreadsheetMeta(sheetsApi, spreadsheetId, { bypassCache = false } = {}) {
  const key = String(spreadsheetId);
  const now = Date.now();
  if (!bypassCache) {
    const cached = spreadsheetMetaCache.get(key);
    if (cached && cached.expiresAt > now) return cached.data;
  }
  const res = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,hidden,index),namedRanges",
  });
  const data = parseSpreadsheetMetaResponse(res.data);
  spreadsheetMetaCache.set(key, { data, expiresAt: now + SPREADSHEET_META_CACHE_TTL_MS });
  return data;
}

async function fetchSpreadsheetSheetTitles(sheetsApi, spreadsheetId, spreadsheetMeta = null) {
  const sheets = spreadsheetMeta?.sheets ?? (await fetchSpreadsheetMeta(sheetsApi, spreadsheetId)).sheets;
  const visible = sheets.filter((sh) => !sh.hidden).map((sh) => sh.title);
  return visible.length ? visible : sheets.map((sh) => sh.title);
}

async function fetchSpreadsheetSheets(sheetsApi, spreadsheetId, spreadsheetMeta = null) {
  if (spreadsheetMeta?.sheets) return spreadsheetMeta.sheets;
  const meta = await fetchSpreadsheetMeta(sheetsApi, spreadsheetId);
  return meta.sheets;
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

function namedRangeToBounds(nr, sheetIdToTitle) {
  if (!nr?.range) return null;
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

async function ensureMonthlySheets({ sheetsApi, spreadsheetId, sheetNames, spreadsheetMeta = null }) {
  const wanted = (sheetNames ?? []).map((name) => String(name ?? "").trim()).filter(Boolean);
  if (!wanted.length) return spreadsheetMeta;

  let sheets = await fetchSpreadsheetSheets(sheetsApi, spreadsheetId, spreadsheetMeta);
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
  if (!requests.length) return spreadsheetMeta;

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
  invalidateSpreadsheetMetaCache(spreadsheetId);
  return fetchSpreadsheetMeta(sheetsApi, spreadsheetId, { bypassCache: true });
}

async function buildNamedRangeBounds(sheetsApi, spreadsheetId, namedRanges, spreadsheetMeta = null) {
  const meta = spreadsheetMeta ?? (await fetchSpreadsheetMeta(sheetsApi, spreadsheetId));
  const wanted = new Set(
    (namedRanges ?? [])
      .map((nr) => String(nr.rangeName ?? "").trim())
      .filter(Boolean),
  );
  const bounds = new Map();
  for (const nr of meta.namedRanges ?? []) {
    const name = String(nr.name ?? "").trim();
    if (!name || !wanted.has(name) || bounds.has(name)) continue;
    const b = namedRangeToBounds(nr, meta.sheetIdToTitle);
    if (b) bounds.set(name, b);
  }
  return { bounds, meta };
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

function resolveSheetIdByTitle(sheetTitle, spreadsheetMeta) {
  if (!spreadsheetMeta) return null;
  const fromMap = spreadsheetMeta.titleToSheetId?.get(sheetTitle);
  if (fromMap != null) return fromMap;
  const found = spreadsheetMeta.sheets?.find((sh) => sh.title === sheetTitle);
  return found?.sheetId ?? spreadsheetMeta.sheets?.[0]?.sheetId ?? null;
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
  columnMeta,
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
  const printSheets = fillRules.print?.sheets ?? {};
  const printOutput = buildSheetPrintOutput({
    detailRows,
    columns,
    tableCfg: tableCfgRaw,
    printSheets: {
      ...printSheets,
      columnMeta,
    },
  });
  const { values, rowLineUnits, printProfile, mode, placements, totalRowSpan } = printOutput;
  const rowSpan = Math.max(
    Number(clearRowCount) || DEFAULT_DETAIL_TABLE_CLEAR_ROWS,
    totalRowSpan || values.length || detailRows.length,
  );

  if (clearRanges && rowSpan > 0 && columns.length > 0) {
    clearRanges.push(
      buildTableRangeA1({
        sheetName: sheetTitle,
        startRow,
        startCol,
        rowCount: rowSpan,
        colCount: columns.length,
      }),
    );
  }
  if (detailRows.length <= 0) return;

  if (mode === "placed" && placements?.length) {
    for (const placement of placements) {
      const absRow = startRow + placement.rowOffset;
      data.push({
        range: buildTableRangeA1({
          sheetName: sheetTitle,
          startRow: absRow,
          startCol,
          rowCount: 1,
          colCount: columns.length,
        }),
        values: [placement.values],
      });
    }
    data.push({
      range: null,
      values: [],
      __printMeta: {
        sheetTitle,
        startRow,
        startCol,
        totalRowSpan: rowSpan,
        mode: "placed",
        placements: placements.map((p) => ({
          absoluteRow0: startRow + p.rowOffset,
          lineUnits: p.lineUnits,
        })),
        colCount: columns.length,
        printProfile,
      },
    });
    return;
  }

  const range = buildTableRangeA1({
    sheetName: sheetTitle,
    startRow,
    startCol,
    rowCount: values.length,
    colCount: columns.length,
  });
  data.push({
    range,
    values,
    __printMeta: {
      sheetTitle,
      startRow,
      startCol,
      rowCount: values.length,
      totalRowSpan: values.length,
      mode: "contiguous",
      rowLineUnits,
      colCount: columns.length,
      printProfile,
    },
  });
}

async function loadDetailTableColumnMeta({
  sheetsApi,
  spreadsheetId,
  fillRules,
  categoryKey,
  sheetTitle,
}) {
  const defaultTable = CHUNG_TU_DEFAULT_SHEET_TABLE[categoryKey] ?? null;
  const tableCfg = fillRules.sheets?.detailTable ?? defaultTable;
  if (!tableCfg?.columns?.length) return null;
  const templateRow = Number.isFinite(Number(tableCfg.templateRow))
    ? Number(tableCfg.templateRow)
    : Number(tableCfg.startRow ?? defaultTable?.startRow ?? 8);
  try {
    return await fetchSheetTemplateColumnMeta(sheetsApi, spreadsheetId, {
      sheetTitle,
      templateRow0: templateRow,
      startCol0: Number(tableCfg.startCol ?? defaultTable?.startCol ?? 0),
      columns: tableCfg.columns,
    });
  } catch {
    return null;
  }
}

async function applySheetPrintFormatting({ sheetsApi, spreadsheetId, dataUpdates, spreadsheetMeta }) {
  const requests = [];
  const sheetIdCache = new Map();
  let metaForSheets = spreadsheetMeta;
  for (const item of dataUpdates) {
    const meta = item.__printMeta;
    if (!meta?.printProfile?.enabled) continue;
    const sheetTitle = meta.sheetTitle;
    if (!sheetTitle) continue;
    let sheetId = sheetIdCache.get(sheetTitle);
    if (sheetId == null) {
      if (!metaForSheets) {
        metaForSheets = await fetchSpreadsheetMeta(sheetsApi, spreadsheetId);
      }
      sheetId = resolveSheetIdByTitle(sheetTitle, metaForSheets);
      sheetIdCache.set(sheetTitle, sheetId);
    }
    if (sheetId == null) continue;

    const rowSpan = meta.totalRowSpan || meta.rowCount || 0;
    if (!rowSpan) continue;

    const wrapReq = buildWrapTextRepeatCellRequest({
      sheetId,
      startRow0: meta.startRow,
      startCol0: meta.startCol ?? 0,
      rowCount: rowSpan,
      colCount: meta.colCount ?? 1,
    });
    if (wrapReq) requests.push(wrapReq);

    const autoResize = buildAutoResizeRowsRequest({
      sheetId,
      startRow0: meta.startRow,
      rowCount: rowSpan,
    });
    if (autoResize) requests.push(autoResize);

    if (meta.mode === "placed" && Array.isArray(meta.placements) && meta.placements.length) {
      requests.push(
        ...buildPerRowHeightUpdateRequestsFromPlacements({
          sheetId,
          placements: meta.placements,
          rowHeightPt: meta.printProfile.rowHeightPt,
        }),
      );
    } else if (Array.isArray(meta.rowLineUnits) && meta.rowLineUnits.length) {
      requests.push(
        ...buildPerRowHeightUpdateRequests({
          sheetId,
          startRow0: meta.startRow,
          rowLineUnits: meta.rowLineUnits,
          rowHeightPt: meta.printProfile.rowHeightPt,
        }),
      );
    }
  }
  if (!requests.length) return;
  try {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  } catch {
    // Định dạng in là tùy chọn; dữ liệu đã ghi vẫn hợp lệ.
  }
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
    let spreadsheetMeta = await fetchSpreadsheetMeta(sheetsApi, spreadsheetId);
    spreadsheetMeta = await ensureMonthlySheets({
      sheetsApi,
      spreadsheetId,
      sheetNames,
      spreadsheetMeta,
    });
    const { bounds: namedRangeBounds, meta: boundsMeta } = await buildNamedRangeBounds(
      sheetsApi,
      spreadsheetId,
      fillRules.sheets?.namedRanges,
      spreadsheetMeta,
    );
    spreadsheetMeta = boundsMeta;
    const data = [];
    const clearRanges = [];
    const columnMetaCache = new Map();
    const templateSheetForColumnMeta = resolveDetailTableSheetTitle(
      fillRules.sheets?.detailTable?.sheetName,
      sheetNames,
      sheetNames,
    );
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
      let columnMeta = columnMetaCache.get(DETAIL_TABLE_COLUMN_META_CACHE_KEY);
      if (columnMeta === undefined) {
        columnMeta = await loadDetailTableColumnMeta({
          sheetsApi,
          spreadsheetId,
          fillRules,
          categoryKey,
          sheetTitle: templateSheetForColumnMeta,
        });
        columnMetaCache.set(DETAIL_TABLE_COLUMN_META_CACHE_KEY, columnMeta);
      }
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
        columnMeta,
      });
    }
    return commitSheetValueUpdates({
      sheetsApi,
      spreadsheetId,
      data,
      clearRanges,
      spreadsheetMeta,
    });
  }

  const spreadsheetMeta = await fetchSpreadsheetMeta(sheetsApi, spreadsheetId);
  const sheetTitles = await fetchSpreadsheetSheetTitles(sheetsApi, spreadsheetId, spreadsheetMeta);
  const namedRangeSheetTitles = [];
  const data = [];
  const clearRanges = [];
  const { bounds: namedRangeBounds } = await buildNamedRangeBounds(
    sheetsApi,
    spreadsheetId,
    fillRules.sheets?.namedRanges,
    spreadsheetMeta,
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
    columnMeta: await loadDetailTableColumnMeta({
      sheetsApi,
      spreadsheetId,
      fillRules,
      categoryKey,
      sheetTitle: resolveDetailTableSheetTitle(
        fillRules.sheets?.detailTable?.sheetName,
        sheetTitles,
        namedRangeSheetTitles,
      ),
    }),
  });

  return commitSheetValueUpdates({
    sheetsApi,
    spreadsheetId,
    data,
    clearRanges,
    spreadsheetMeta,
  });
}

async function commitSheetValueUpdates({
  sheetsApi,
  spreadsheetId,
  data,
  clearRanges = [],
  spreadsheetMeta = null,
}) {
  if (data.length === 0 && clearRanges.length === 0) {
    return { updatedRanges: 0 };
  }

  const printMetaItems = data.filter((item) => item.__printMeta);
  const payload = data.filter((item) => item.range).map(({ range, values }) => ({ range, values }));

  try {
    if (clearRanges.length > 0) {
      await sheetsApi.spreadsheets.values.batchClear({
        spreadsheetId,
        requestBody: { ranges: clearRanges },
      });
    }
    if (payload.length > 0) {
      await sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: payload,
        },
      });
    }
    if (printMetaItems.length > 0) {
      await applySheetPrintFormatting({
        sheetsApi,
        spreadsheetId,
        dataUpdates: printMetaItems,
        spreadsheetMeta,
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

  return { updatedRanges: payload.length, clearedRanges: clearRanges.length };
}
