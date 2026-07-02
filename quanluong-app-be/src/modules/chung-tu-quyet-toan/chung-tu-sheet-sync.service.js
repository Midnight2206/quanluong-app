import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { createDriveClient } from "../../shared/utils/google-drive-fetch.api.js";
import { createSheetsClient } from "../../shared/utils/google-sheets-fetch.api.js";
import { CHUNG_TU_DEFAULT_SHEET_TABLE, excelColumnLetter } from "./chung-tu-category.constants.js";
import { detailColumnFieldKeys } from "./chung-tu-detail-field-catalog.js";
import {
  enrichDetailTableLayoutFromTemplate,
  enrichFillRulesWithSpreadsheetMeta,
  formatDerivedNamedRangeValue,
  loadFillRulesForCategoryTemplate,
} from "./chung-tu-template-fill-config.service.js";
import { getDerivedNamedRangeSetForCategory } from "./chung-tu-category.constants.js";
import { resolveTemplateSheetTitle } from "./chung-tu-monthly-sheets.js";
import {
  buildApplyDataRowFormatsRequest,
  buildApplyTotalRowFormatRequest,
  buildCopyTemplateRowFormatRequest,
  buildDeleteExtraDataRowsRequest,
  buildDetailTableFillPlan,
  buildInsertDataRowsRequestFromPlan,
  buildPerRowHeightUpdateRequests,
  buildTableCellA1,
  buildTotalRowAmountCellA1,
  fetchSheetTemplateColumnMeta,
  fetchTemplateRowCellFormats,
  fetchTemplateTotalRowCellFormats,
  resolveNamedRangeTargetCell,
  resolveOverflowFormatTarget,
} from "./chung-tu-sheet-print-pagination.js";

const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
/** Fill named range tự động (ngày, số, tổng bằng chữ) — ghi sau khi layout bảng chi tiết. */
const NAMED_RANGE_SYNC_ENABLED = true;
const DEFAULT_PREVIOUS_DATA_ROW_COUNT = 1;
const SPREADSHEET_META_CACHE_TTL_MS = 2 * 60 * 1000;
const DETAIL_TABLE_COLUMN_META_CACHE_KEY = "__detail_table_column_meta__";

function shouldSkipNamedRangeUpdate(categoryKey, rule) {
  if (rule?.rule === "static") return true;
  const fieldKey = String(rule?.fieldKey ?? "").trim();
  const allowed = getDerivedNamedRangeSetForCategory(categoryKey);
  return !fieldKey || !allowed.has(fieldKey);
}

/** @type {Map<string, { expiresAt: number, data: object }>} */
const spreadsheetMetaCache = new Map();

function contextFieldValue(context, fieldKey) {
  if (!fieldKey) return "";
  const v = context[fieldKey];
  if (v == null) return "";
  const raw =
    typeof v === "number" || typeof v === "boolean" ? String(v) : String(v);
  return formatDerivedNamedRangeValue(fieldKey, raw);
}

function colLetter(index) {
  return excelColumnLetter(index);
}

async function loadFillRulesForTemplate(templateDriveFileId, categoryKey) {
  return loadFillRulesForCategoryTemplate(templateDriveFileId, categoryKey, {
    requireSavedDetailTable: true,
    skipTemplateNamedRangeFetch: true,
  });
}

function assertTemplateDetailTableConfigured(fillRules, { templateDriveFileId, categoryKey } = {}) {
  const table = fillRules?.sheets?.detailTable;
  const mappings = Array.isArray(table?.columnMappings) ? table.columnMappings : [];
  const legacyCols = Array.isArray(table?.columns) ? table.columns : [];
  const hasMappings = mappings.some((item) => String(item?.fieldKey ?? "").trim());
  const hasLegacy = legacyCols.some((col) => String(col ?? "").trim());
  if (table && (hasMappings || hasLegacy)) {
    return;
  }
  throw new AppError({
    message:
      "Mẫu Google Sheets này chưa có cấu hình map bảng chi tiết. Mở «Map dữ liệu → ô mẫu» trên đúng mẫu đang dùng, cấu hình cột/dòng rồi bấm «Lưu map».",
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    details: { templateDriveFileId, categoryKey },
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

function buildTableRangeA1({ sheetName, startRow, startCol, rowCount, colCount }) {
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

function pushContextNamedRangeUpdates({
  namedRangeWrites,
  fillRules,
  namedRangeBounds,
  context,
  sheetName,
  categoryKey,
}) {
  if (!NAMED_RANGE_SYNC_ENABLED) return;
  for (const nr of fillRules.sheets?.namedRanges ?? []) {
    if (!nr.rangeName) continue;
    if (shouldSkipNamedRangeUpdate(categoryKey, nr)) continue;
    const bounds = namedRangeBounds.get(nr.rangeName);
    if (!bounds) continue;
    const targetSheetName = sheetName || bounds.sheetTitle;
    const value = contextFieldValue(context, nr.fieldKey);
    if (!value) continue;
    namedRangeWrites.push({
      rangeName: nr.rangeName,
      sheetName: targetSheetName,
      value,
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

function resolvePreviousDataRowCount(layoutBySheet, sheetName) {
  if (!layoutBySheet || typeof layoutBySheet !== "object") {
    return DEFAULT_PREVIOUS_DATA_ROW_COUNT;
  }
  const key = String(sheetName ?? "").trim();
  const stored = key ? layoutBySheet[key] : layoutBySheet.__default;
  const n = Number(stored);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PREVIOUS_DATA_ROW_COUNT;
}

function pushContextDetailTableUpdate({
  data,
  layoutJobs,
  fillRules,
  categoryKey,
  context,
  sheetName,
  sheetTitles,
  namedRangeSheetTitles,
  columnMeta,
  previousDataRowCount,
}) {
  const tableCfgRaw = fillRules.sheets?.detailTable;
  const detailRows = Array.isArray(context.detailRows) ? context.detailRows : [];
  if (!tableCfgRaw || detailRows.length <= 0) return null;

  const columns =
    detailColumnFieldKeys(tableCfgRaw).length > 0
      ? detailColumnFieldKeys(tableCfgRaw)
      : tableCfgRaw.columns ?? [];
  const sheetTitle =
    sheetName ||
    resolveDetailTableSheetTitle(tableCfgRaw.sheetName, sheetTitles, namedRangeSheetTitles);
  const plan = buildDetailTableFillPlan({
    detailRows,
    columns,
    tableCfg: tableCfgRaw,
    printSheets: fillRules.print?.sheets ?? {},
    context,
    columnMeta,
  });
  if (!plan.dataRowCount) return null;

  layoutJobs.push({
    sheetTitle,
    plan,
    columns: plan.fieldKeys ?? columns,
    previousDataRowCount: resolvePreviousDataRowCount(
      typeof previousDataRowCount === "object" ? previousDataRowCount : null,
      sheetTitle,
    ),
  });

  const range = buildTableRangeA1({
    sheetName: sheetTitle,
    startRow: plan.startRow,
    startCol: plan.writeStartCol ?? plan.startCol,
    rowCount: plan.dataRowCount,
    colCount: plan.writeColCount ?? columns.length,
  });
  data.push({ range, values: plan.values });

  data.push({
    range: buildTotalRowAmountCellA1({
      sheetName: sheetTitle,
      totalRow0: plan.totalRow0,
      startCol0: plan.writeStartCol ?? plan.startCol,
      columns: plan.fieldKeys ?? columns,
      amountFieldKey: plan.amountFieldKey,
      columnMappings: plan.columnMappings,
    }),
    values: [[String(plan.totalAmount ?? "")]],
  });

  const labelMapping = (plan.columnMappings ?? []).find(
    (item) => item.fieldKey === plan.labelFieldKey,
  );
  if (labelMapping && plan.totalLabel) {
    data.push({
      range: buildTableCellA1({
        sheetName: sheetTitle,
        row0: plan.totalRow0,
        col0: Number(labelMapping.col),
      }),
      values: [[plan.totalLabel]],
    });
  }

  data.push({
    range: null,
    values: [],
    __printMeta: {
      sheetTitle,
      startRow: plan.startRow,
      startCol: plan.startCol,
      dataRowCount: plan.dataRowCount,
      rowLineUnits: plan.rowLineUnits,
      rowHeightPt: plan.rowHeightPt,
      colCount: plan.writeColCount ?? columns.length,
      amountColIndex: (plan.columnMappings ?? []).findIndex(
        (item) => item.fieldKey === plan.amountFieldKey,
      ),
    },
  });

  return { sheetTitle, dataRowCount: plan.dataRowCount };
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
  const hasMappings = Array.isArray(tableCfg?.columnMappings) && tableCfg.columnMappings.length > 0;
  if (!tableCfg?.columns?.length && !hasMappings) return null;
  const fieldKeys = hasMappings
    ? tableCfg.columnMappings.map((item) => item.fieldKey).filter(Boolean)
    : tableCfg.columns;
  const templateRow = Number.isFinite(Number(tableCfg.templateRow))
    ? Number(tableCfg.templateRow)
    : Number(tableCfg.startRow ?? defaultTable?.startRow ?? 8);
  try {
    return await fetchSheetTemplateColumnMeta(sheetsApi, spreadsheetId, {
      sheetTitle,
      templateRow0: templateRow,
      startCol0: Number(tableCfg.startCol ?? defaultTable?.startCol ?? 0),
      columns: fieldKeys,
    });
  } catch {
    return null;
  }
}

async function applyDetailTableLayout({
  sheetsApi,
  spreadsheetId,
  layoutJobs,
  spreadsheetMeta,
  templateSpreadsheetId = null,
  formatTemplateSheetTitle = "",
}) {
  if (!layoutJobs?.length) return spreadsheetMeta;

  const requests = [];
  let metaForSheets = spreadsheetMeta;
  const formatSourceSpreadsheetId = templateSpreadsheetId || spreadsheetId;

  for (const job of layoutJobs) {
    const { sheetTitle, plan, columns, previousDataRowCount } = job;
    let sheetId = metaForSheets?.titleToSheetId?.get(sheetTitle);
    if (sheetId == null) {
      if (!metaForSheets) {
        metaForSheets = await fetchSpreadsheetMeta(sheetsApi, spreadsheetId);
      }
      sheetId = resolveSheetIdByTitle(sheetTitle, metaForSheets);
    }
    if (sheetId == null) continue;

    const writeStartCol = plan.writeStartCol ?? plan.startCol;
    const writeColCount = plan.writeColCount ?? columns.length;
    const totalRowShifts = Number(plan.totalRow0) !== Number(plan.totalTemplateRow);
    let totalRowFormats = null;
    if (totalRowShifts) {
      const formatSourceSheet = formatTemplateSheetTitle || sheetTitle;
      try {
        totalRowFormats = await fetchTemplateTotalRowCellFormats(
          sheetsApi,
          formatSourceSpreadsheetId,
          {
            sheetTitle: formatSourceSheet,
            totalTemplateRow0: plan.totalTemplateRow,
            startCol0: writeStartCol,
            colCount: writeColCount,
          },
        );
      } catch {
        totalRowFormats = null;
      }
    }

    const insertReq = buildInsertDataRowsRequestFromPlan({
      sheetId,
      plan,
      previousDataRowCount,
    });
    const deleteReq = buildDeleteExtraDataRowsRequest({
      sheetId,
      plan,
      previousDataRowCount,
    });
    if (deleteReq) requests.push(deleteReq);
    if (insertReq) requests.push(insertReq);

    const { overflowCount, destStartRow } = resolveOverflowFormatTarget(plan);

    if (overflowCount > 0) {
      let templateFormats = null;
      try {
        templateFormats = await fetchTemplateRowCellFormats(sheetsApi, spreadsheetId, {
          sheetTitle,
          row0: plan.templateRow,
          startCol0: writeStartCol,
          colCount: writeColCount,
        });
      } catch {
        templateFormats = null;
      }

      const applyFormatReq = templateFormats?.length
        ? buildApplyDataRowFormatsRequest({
            sheetId,
            templateRowFormats: templateFormats,
            startRow0: destStartRow,
            dataRowCount: overflowCount,
            startCol0: writeStartCol,
          })
        : null;

      if (applyFormatReq) {
        requests.push(applyFormatReq);
      } else {
        const copyDataFormatReq = buildCopyTemplateRowFormatRequest({
          sheetId,
          templateRow0: plan.templateRow,
          startRow0: plan.startRow,
          dataRowCount: plan.dataRowCount,
          startCol0: writeStartCol,
          colCount: writeColCount,
          totalTemplateRow0: plan.totalTemplateRow,
        });
        if (copyDataFormatReq) requests.push(copyDataFormatReq);
      }
    }

    if (totalRowShifts && totalRowFormats?.length) {
      const applyTotalReq = buildApplyTotalRowFormatRequest({
        sheetId,
        totalRow0: plan.totalRow0,
        startCol0: writeStartCol,
        cellFormats: totalRowFormats,
      });
      if (applyTotalReq) requests.push(applyTotalReq);
    }
  }

  if (!requests.length) return metaForSheets;

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
  invalidateSpreadsheetMetaCache(spreadsheetId);
  return fetchSpreadsheetMeta(sheetsApi, spreadsheetId, { bypassCache: true });
}

async function applySheetRowHeights({ sheetsApi, spreadsheetId, dataUpdates, spreadsheetMeta }) {
  const requests = [];
  const sheetIdCache = new Map();
  let metaForSheets = spreadsheetMeta;
  for (const item of dataUpdates) {
    const meta = item.__printMeta;
    if (!meta?.rowLineUnits?.length) continue;
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
    requests.push(
      ...buildPerRowHeightUpdateRequests({
        sheetId,
        startRow0: meta.startRow,
        rowLineUnits: meta.rowLineUnits,
        rowHeightPt: meta.rowHeightPt,
      }),
    );
  }
  if (!requests.length) return;
  try {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  } catch {
    // Chiều cao hàng là tùy chọn.
  }
}

export async function syncSpreadsheetFromContext({
  oauth2Client,
  spreadsheetId,
  templateDriveFileId,
  categoryKey,
  context,
  layoutRowCountBySheet = null,
}) {
  const drive = createDriveClient(oauth2Client);
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

  const fillRulesBase = await loadFillRulesForTemplate(templateDriveFileId, categoryKey);
  assertTemplateDetailTableConfigured(fillRulesBase, { templateDriveFileId, categoryKey });
  const fillRulesFromTemplate = await enrichDetailTableLayoutFromTemplate(
    oauth2Client,
    templateDriveFileId,
    fillRulesBase,
    categoryKey,
  );
  const sheetsApi = createSheetsClient(oauth2Client);
  const sheetContexts = Array.isArray(context.sheetContexts) ? context.sheetContexts : [];
  if (sheetContexts.length > 0) {
    const sheetNames = sheetContexts.map((ctx) => ctx.sheetName).filter(Boolean);
    let spreadsheetMeta = await fetchSpreadsheetMeta(sheetsApi, spreadsheetId);
    const fillRules = enrichFillRulesWithSpreadsheetMeta(
      fillRulesFromTemplate,
      spreadsheetMeta,
      categoryKey,
    );
    spreadsheetMeta = await ensureMonthlySheets({
      sheetsApi,
      spreadsheetId,
      sheetNames,
      spreadsheetMeta,
    });
    let namedRangeBounds = new Map();
    if (NAMED_RANGE_SYNC_ENABLED) {
      const boundsResult = await buildNamedRangeBounds(
        sheetsApi,
        spreadsheetId,
        fillRules.sheets?.namedRanges,
        spreadsheetMeta,
      );
      namedRangeBounds = boundsResult.bounds;
      spreadsheetMeta = boundsResult.meta;
    }
    const data = [];
    const namedRangeWrites = [];
    const layoutJobs = [];
    const layoutResults = [];
    const columnMetaCache = new Map();
    const templateSheetForColumnMeta = resolveDetailTableSheetTitle(
      fillRules.sheets?.detailTable?.sheetName,
      sheetNames,
      sheetNames,
    );
    for (const ctx of sheetContexts) {
      const sheetName = ctx.sheetName;
      pushContextNamedRangeUpdates({
        namedRangeWrites,
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
      const layoutResult = pushContextDetailTableUpdate({
        data,
        layoutJobs,
        fillRules,
        categoryKey,
        context: ctx,
        sheetName,
        sheetTitles: sheetNames,
        namedRangeSheetTitles: sheetNames,
        columnMeta,
        previousDataRowCount: layoutRowCountBySheet,
      });
      if (layoutResult) layoutResults.push(layoutResult);
    }
    return commitSheetValueUpdates({
      sheetsApi,
      spreadsheetId,
      data,
      layoutJobs,
      spreadsheetMeta,
      layoutResults,
      templateSpreadsheetId: templateDriveFileId,
      formatTemplateSheetTitle: resolveTemplateSheetTitle(
        fillRules.sheets?.detailTable?.sheetName
          ? [fillRules.sheets.detailTable.sheetName, ...sheetNames]
          : sheetNames,
      ),
      fillRules,
      namedRangeWrites,
    });
  }

  const spreadsheetMeta = await fetchSpreadsheetMeta(sheetsApi, spreadsheetId);
  const fillRules = enrichFillRulesWithSpreadsheetMeta(
    fillRulesFromTemplate,
    spreadsheetMeta,
    categoryKey,
  );
  const sheetTitles = await fetchSpreadsheetSheetTitles(sheetsApi, spreadsheetId, spreadsheetMeta);
  const namedRangeSheetTitles = [];
  const data = [];
  const namedRangeWrites = [];
  const layoutJobs = [];
  const layoutResults = [];
  if (NAMED_RANGE_SYNC_ENABLED) {
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

      const value = contextFieldValue(context, nr.fieldKey);
      if (!value) continue;
      namedRangeWrites.push({
        rangeName: nr.rangeName,
        sheetName: bounds.sheetTitle,
        value,
      });
    }
  }

  const layoutResult = pushContextDetailTableUpdate({
    data,
    layoutJobs,
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
    previousDataRowCount: layoutRowCountBySheet,
  });
  if (layoutResult) layoutResults.push(layoutResult);

  return commitSheetValueUpdates({
    sheetsApi,
    spreadsheetId,
    data,
    layoutJobs,
    spreadsheetMeta,
    layoutResults,
    templateSpreadsheetId: templateDriveFileId,
    formatTemplateSheetTitle: resolveTemplateSheetTitle(
      fillRules.sheets?.detailTable?.sheetName
        ? [fillRules.sheets.detailTable.sheetName, ...sheetTitles]
        : sheetTitles,
    ),
    fillRules,
    namedRangeWrites,
  });
}

async function applyDeferredNamedRangeWrites({
  sheetsApi,
  spreadsheetId,
  fillRules,
  namedRangeWrites,
  layoutJobs = [],
  spreadsheetMeta: _spreadsheetMeta,
}) {
  if (!NAMED_RANGE_SYNC_ENABLED || !namedRangeWrites?.length) return 0;

  const { bounds: namedRangeBounds } = await buildNamedRangeBounds(
    sheetsApi,
    spreadsheetId,
    fillRules.sheets?.namedRanges,
    await fetchSpreadsheetMeta(sheetsApi, spreadsheetId, { bypassCache: true }),
  );

  const detailTable = fillRules?.sheets?.detailTable ?? {};
  const layoutPlanBySheet = new Map(
    (layoutJobs ?? []).map((job) => [String(job.sheetTitle ?? "").trim(), job.plan]),
  );
  const namedRangeRules = fillRules?.sheets?.namedRanges ?? [];

  const payload = [];
  for (const item of namedRangeWrites) {
    const nrRule = namedRangeRules.find(
      (rule) => String(rule.rangeName ?? "").trim() === String(item.rangeName ?? "").trim(),
    );
    const bounds = namedRangeBounds.get(item.rangeName);
    const sheetKey = String(item.sheetName || bounds?.sheetTitle || nrRule?.sheetName || "").trim();
    const layoutPlan =
      (sheetKey ? layoutPlanBySheet.get(sheetKey) : null) ?? layoutJobs?.[0]?.plan ?? null;
    const target = resolveNamedRangeTargetCell({
      nrRule,
      bounds,
      detailTable,
      layoutPlan,
    });
    if (!target) continue;
    const targetSheetName = sheetKey || target.sheetTitle;
    payload.push({
      range: buildSingleCellFromBounds({
        sheetName: targetSheetName,
        startRow: target.startRow,
        startCol: target.startCol,
      }),
      values: [[item.value]],
    });
  }

  if (!payload.length) return 0;

  await sheetsApi.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: payload,
    },
  });
  return payload.length;
}

async function commitSheetValueUpdates({
  sheetsApi,
  spreadsheetId,
  data,
  layoutJobs = [],
  spreadsheetMeta = null,
  layoutResults = [],
  templateSpreadsheetId = null,
  formatTemplateSheetTitle = "",
  fillRules = null,
  namedRangeWrites = [],
}) {
  if (data.length === 0 && layoutJobs.length === 0 && !namedRangeWrites?.length) {
    return { updatedRanges: 0, layoutRowCountBySheet: null };
  }

  const printMetaItems = data.filter((item) => item.__printMeta);
  const payload = data.filter((item) => item.range).map(({ range, values }) => ({ range, values }));
  let namedRangeUpdated = 0;

  try {
    let meta = spreadsheetMeta;
    if (layoutJobs.length > 0) {
      meta = await applyDetailTableLayout({
        sheetsApi,
        spreadsheetId,
        layoutJobs,
        spreadsheetMeta: meta,
        templateSpreadsheetId,
        formatTemplateSheetTitle,
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
    if (namedRangeWrites?.length && fillRules) {
      namedRangeUpdated = await applyDeferredNamedRangeWrites({
        sheetsApi,
        spreadsheetId,
        fillRules,
        namedRangeWrites,
        layoutJobs,
        spreadsheetMeta: meta,
      });
    }
    if (printMetaItems.length > 0) {
      await applySheetRowHeights({
        sheetsApi,
        spreadsheetId,
        dataUpdates: printMetaItems,
        spreadsheetMeta: meta,
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

  let layoutRowCountBySheet = null;
  if (layoutResults.length > 0) {
    layoutRowCountBySheet = {};
    for (const item of layoutResults) {
      if (item?.sheetTitle) {
        layoutRowCountBySheet[item.sheetTitle] = item.dataRowCount;
      } else {
        layoutRowCountBySheet.__default = item.dataRowCount;
      }
    }
  }

  return {
    updatedRanges: payload.length + namedRangeUpdated,
    layoutRowCountBySheet,
  };
}
