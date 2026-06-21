import { amountFromRow } from "./chung-tu-row-amount.util.js";
import { CHUNG_TU_DEFAULT_SHEET_PRINT } from "./chung-tu-category.constants.js";
import { resolveDetailColumnMappings } from "./chung-tu-detail-field-catalog.js";

function estimateCharsPerLine(columnWidthPx) {
  const w = Number(columnWidthPx) || 72;
  return Math.max(1, Math.floor(w / 7));
}

function isWrapEnabled(format) {
  const strategy = format?.wrapStrategy ?? format?.userEnteredFormat?.wrapStrategy;
  return strategy === "WRAP" || strategy === "LEGACY_WRAP";
}

function normalizeSheetTableConfig(tableCfg = {}, printSheets = {}) {
  const merged = { ...printSheets, ...tableCfg };
  const rowHeightPt =
    Number.isFinite(Number(merged.rowHeightPt)) && Number(merged.rowHeightPt) > 0
      ? Number(merged.rowHeightPt)
      : CHUNG_TU_DEFAULT_SHEET_PRINT.rowHeightPt;

  const startRow =
    Number.isFinite(Number(merged.startRow)) && Number(merged.startRow) >= 0
      ? Number(merged.startRow)
      : 8;
  const templateRow =
    Number.isFinite(Number(merged.templateRow)) && Number(merged.templateRow) >= 0
      ? Number(merged.templateRow)
      : startRow;
  const totalTemplateRow =
    Number.isFinite(Number(merged.totalTemplateRow)) && Number(merged.totalTemplateRow) >= 0
      ? Number(merged.totalTemplateRow)
      : startRow + 1;

  return {
    startRow,
    startCol: Number.isFinite(Number(merged.startCol)) && Number(merged.startCol) >= 0 ? Number(merged.startCol) : 0,
    templateRow,
    totalTemplateRow,
    rowHeightPt,
    amountFieldKey: String(merged.amountFieldKey ?? "thanhTien").trim() || "thanhTien",
    totalLabel: String(merged.totalLabel ?? "Tổng cộng").trim() || "Tổng cộng",
    labelFieldKey: String(merged.labelFieldKey ?? "tenHang").trim() || "tenHang",
  };
}

function buildColumnMetaFromGridData(gridData, startCol0, columns) {
  const rowData = gridData?.rowData?.[0];
  const values = rowData?.values ?? [];
  const columnMeta = {};
  for (let i = 0; i < columns.length; i += 1) {
    const fieldKey = columns[i];
    const cell = values[startCol0 + i] ?? values[i];
    const effective = cell?.effectiveFormat ?? {};
    const userEntered = cell?.userEnteredFormat ?? {};
    const widthPx = Number(gridData?.columnMetadata?.[startCol0 + i]?.pixelSize) || 72;
    columnMeta[fieldKey] = {
      width: widthPx,
      wrapText: isWrapEnabled(effective) || isWrapEnabled(userEntered),
      fontSize: Number(effective?.textFormat?.fontSize) || 11,
    };
  }
  return columnMeta;
}

function estimateRowUnits(row, columns, columnMeta) {
  let maxLines = 1;
  for (const fieldKey of columns) {
    const meta = columnMeta[fieldKey];
    if (!meta) continue;
    const text = String(row?.[fieldKey] ?? "");
    if (!text) continue;
    const charsPerLine = estimateCharsPerLine(meta.width);
    const lines = meta.wrapText ? Math.max(1, Math.ceil(text.length / charsPerLine)) : 1;
    maxLines = Math.max(maxLines, lines);
  }
  return maxLines;
}

function resolveDataSlotsInTemplate(cfg) {
  return Math.max(1, Number(cfg.totalTemplateRow) - Number(cfg.startRow));
}

function resolveTotalRowIndex(cfg, dataRowCount) {
  const slots = resolveDataSlotsInTemplate(cfg);
  const count = Math.max(0, Number(dataRowCount) || 0);
  return Number(cfg.totalTemplateRow) + Math.max(0, count - slots);
}

/**
 * Vị trí ghi named range sau khi chèn dòng data.
 * Ô footer (>= totalTemplateRow) dịch theo totalRow0 — không dùng bounds API vì insert tại totalTemplateRow
 * khiến named range trên Google Sheets có thể không dịch theo hàng tổng.
 */
function resolveNamedRangeTargetCell({ nrRule, bounds, detailTable, layoutPlan }) {
  const tableCfg = detailTable && typeof detailTable === "object" ? detailTable : {};
  const totalTemplateRow = Number(tableCfg.totalTemplateRow);
  const templateRow = Number(nrRule?.templateRowIndex ?? bounds?.startRow);
  const startCol = Number(nrRule?.templateColIndex ?? bounds?.startCol ?? 0);
  const sheetTitle =
    String(bounds?.sheetTitle ?? nrRule?.sheetName ?? tableCfg.sheetName ?? "").trim() || "Sheet1";

  if (
    Number.isFinite(totalTemplateRow) &&
    Number.isFinite(templateRow) &&
    templateRow >= totalTemplateRow
  ) {
    const totalRow0 = Number(layoutPlan?.totalRow0);
    if (Number.isFinite(totalRow0)) {
      return {
        sheetTitle,
        startRow: totalRow0 + (templateRow - totalTemplateRow),
        startCol,
      };
    }
  }

  if (bounds) {
    return {
      sheetTitle: bounds.sheetTitle,
      startRow: bounds.startRow,
      startCol: bounds.startCol,
    };
  }
  if (Number.isFinite(templateRow)) {
    return { sheetTitle, startRow: templateRow, startCol };
  }
  return null;
}

function resolveRowOverflowCount(cfg, dataRowCount) {
  const slots = resolveDataSlotsInTemplate(cfg);
  const count = Math.max(0, Number(dataRowCount) || 0);
  return Math.max(0, count - slots);
}

function resolveRowInsertIndex(cfg, previousDataRowCount) {
  const prevOverflow = resolveRowOverflowCount(cfg, previousDataRowCount);
  return Number(cfg.totalTemplateRow) + prevOverflow;
}

function detailRowToCells(row, columnMappings) {
  const mappings = Array.isArray(columnMappings) ? columnMappings : [];
  if (!mappings.length) return [];
  const cols = mappings.map((item) => Number(item.col));
  const startCol = Math.min(...cols);
  const endCol = Math.max(...cols);
  const width = endCol - startCol + 1;
  const cells = Array(width).fill("");
  for (const mapping of mappings) {
    const offset = Number(mapping.col) - startCol;
    const v = row?.[mapping.fieldKey];
    cells[offset] = v == null ? "" : v;
  }
  return cells;
}

function resolveTableWriteWindow(columnMappings, fallbackStartCol = 0) {
  const mappings = Array.isArray(columnMappings) ? columnMappings : [];
  if (!mappings.length) {
    return { startCol: Number(fallbackStartCol) || 0, colCount: 0 };
  }
  const cols = mappings.map((item) => Number(item.col));
  const startCol = Math.min(...cols);
  const endCol = Math.max(...cols);
  return { startCol, colCount: endCol - startCol + 1 };
}

function resolveTotalAmount(context, detailRows, amountFieldKey) {
  const fromContext = context?.tongTienSo;
  if (Number.isFinite(Number(fromContext))) return Number(fromContext);
  return (detailRows ?? []).reduce((sum, row) => sum + amountFromRow(row, amountFieldKey), 0);
}

function resolveTotalAmountDisplay(context, detailRows, amountFieldKey) {
  if (context?.tongTien != null && String(context.tongTien).trim()) {
    return context.tongTien;
  }
  return resolveTotalAmount(context, detailRows, amountFieldKey);
}

/** Kế hoạch fill bảng chi tiết: N dòng dữ liệu + giữ dòng tổng mẫu (chỉ ghi thành tiền). */
function buildDetailTableFillPlan({ detailRows, columns, tableCfg, printSheets, context, columnMeta }) {
  const rows = Array.isArray(detailRows) ? detailRows : [];
  const cfg = normalizeSheetTableConfig(tableCfg, printSheets);
  const columnMappings = resolveDetailColumnMappings(
    { ...tableCfg, columns: columns ?? tableCfg?.columns },
    cfg.startCol,
  );
  const fieldKeys = columnMappings.map((item) => item.fieldKey);
  const writeWindow = resolveTableWriteWindow(columnMappings, cfg.startCol);
  const meta = columnMeta ?? {};
  const dataSlotsInTemplate = resolveDataSlotsInTemplate(cfg);

  if (!columnMappings.length || !rows.length) {
    return {
      ...cfg,
      columnMappings,
      fieldKeys,
      writeStartCol: writeWindow.startCol,
      writeColCount: writeWindow.colCount,
      dataSlotsInTemplate,
      dataRowCount: 0,
      values: [],
      rowLineUnits: [],
      totalRow0: resolveTotalRowIndex(cfg, 0),
      totalAmount: resolveTotalAmountDisplay(context, rows, cfg.amountFieldKey),
    };
  }

  const values = rows.map((row) => detailRowToCells(row, columnMappings));
  const rowLineUnits = rows.map((row) => estimateRowUnits(row, fieldKeys, meta));

  return {
    ...cfg,
    columnMappings,
    fieldKeys,
    writeStartCol: writeWindow.startCol,
    writeColCount: writeWindow.colCount,
    dataSlotsInTemplate,
    dataRowCount: rows.length,
    values,
    rowLineUnits,
    totalRow0: resolveTotalRowIndex(cfg, rows.length),
    totalAmount: resolveTotalAmountDisplay(context, rows, cfg.amountFieldKey),
  };
}

async function fetchSheetTemplateColumnMeta(
  sheetsApi,
  spreadsheetId,
  { sheetTitle, templateRow0, startCol0, columns },
) {
  const safeSheet = `'${String(sheetTitle || "Sheet1").replace(/'/g, "''")}'`;
  const colCount = Math.max(columns.length, 1);
  const startCol1 = Number(startCol0) + 1;
  const endCol1 = Number(startCol0) + colCount;
  const row1 = Number(templateRow0) + 1;
  const range = `${safeSheet}!R${row1}C${startCol1}:R${row1}C${endCol1}`;

  const res = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    ranges: [range],
    includeGridData: true,
    fields:
      "sheets(data(rowData(values(effectiveFormat(wrapStrategy,textFormat),userEnteredFormat(wrapStrategy))),columnMetadata(pixelSize)),properties(sheetId,title))",
  });

  const sheet = (res.data.sheets ?? []).find(
    (item) => String(item.properties?.title ?? "") === String(sheetTitle),
  ) ?? res.data.sheets?.[0];
  const gridData = sheet?.data?.[0];
  return buildColumnMetaFromGridData(gridData, Number(startCol0) || 0, columns);
}

function ptToPixelSize(pt) {
  const n = Number(pt);
  if (!Number.isFinite(n) || n <= 0) return 24;
  return Math.round(n * (96 / 72));
}

function buildPerRowHeightUpdateRequests({ sheetId, startRow0, rowLineUnits, rowHeightPt }) {
  if (!Number.isFinite(Number(sheetId)) || !Array.isArray(rowLineUnits) || !rowLineUnits.length) {
    return [];
  }
  const basePt = Number(rowHeightPt) || CHUNG_TU_DEFAULT_SHEET_PRINT.rowHeightPt;
  const requests = [];
  for (let i = 0; i < rowLineUnits.length; i += 1) {
    const units = Math.max(1, Number(rowLineUnits[i]) || 1);
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId: Number(sheetId),
          dimension: "ROWS",
          startIndex: Number(startRow0) + i,
          endIndex: Number(startRow0) + i + 1,
        },
        properties: { pixelSize: ptToPixelSize(basePt * units) },
        fields: "pixelSize",
      },
    });
  }
  return requests;
}

function buildCopyTemplateRowFormatRequest({
  sheetId,
  templateRow0,
  startRow0,
  dataRowCount,
  startCol0,
  colCount,
  totalTemplateRow0,
}) {
  if (!Number.isFinite(Number(sheetId)) || !dataRowCount || dataRowCount <= 0) return null;
  const startRow = Number(startRow0);
  const totalTemplateRow = Number.isFinite(Number(totalTemplateRow0))
    ? Number(totalTemplateRow0)
    : startRow + 1;
  const dataSlots = Math.max(1, totalTemplateRow - startRow);
  const overflowCount = Math.max(0, Number(dataRowCount) - dataSlots);
  if (!overflowCount) return null;

  const startCol = Number(startCol0) || 0;
  const endCol = startCol + Math.max(Number(colCount) || 1, 1);
  const destStartRow = startRow + dataSlots;
  return {
    copyPaste: {
      source: {
        sheetId: Number(sheetId),
        startRowIndex: Number(templateRow0),
        endRowIndex: Number(templateRow0) + 1,
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      destination: {
        sheetId: Number(sheetId),
        startRowIndex: destStartRow,
        endRowIndex: destStartRow + overflowCount,
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      pasteType: "PASTE_FORMAT",
    },
  };
}

function resolveOverflowFormatTarget(plan) {
  const startRow = Number(plan?.startRow);
  const totalTemplateRow = Number(plan?.totalTemplateRow);
  if (!Number.isFinite(startRow) || !Number.isFinite(totalTemplateRow)) {
    return { overflowCount: 0, destStartRow: startRow, dataSlots: 1 };
  }
  const dataSlots = Math.max(1, totalTemplateRow - startRow);
  const overflowCount = Math.max(0, Number(plan?.dataRowCount) - dataSlots);
  return {
    overflowCount,
    destStartRow: startRow + dataSlots,
    dataSlots,
  };
}

function buildCopyTotalRowFormatRequest({
  sheetId,
  totalTemplateRow0,
  totalRow0,
  startCol0,
  colCount,
}) {
  if (!Number.isFinite(Number(sheetId))) return null;
  const startCol = Number(startCol0) || 0;
  const endCol = startCol + Math.max(Number(colCount) || 1, 1);
  const sourceRow = Number(totalTemplateRow0);
  const destRow = Number(totalRow0);
  if (!Number.isFinite(sourceRow) || !Number.isFinite(destRow)) return null;
  if (sourceRow === destRow) return null;
  return {
    copyPaste: {
      source: {
        sheetId: Number(sheetId),
        startRowIndex: sourceRow,
        endRowIndex: sourceRow + 1,
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      destination: {
        sheetId: Number(sheetId),
        startRowIndex: destRow,
        endRowIndex: destRow + 1,
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      pasteType: "PASTE_FORMAT",
    },
  };
}

function buildInsertDataRowsRequest({ sheetId, insertAtRow0, insertCount }) {
  const count = Number(insertCount);
  if (!Number.isFinite(count) || count <= 0) return null;
  const at = Number(insertAtRow0);
  if (!Number.isFinite(at) || at < 0) return null;
  return {
    insertDimension: {
      range: {
        sheetId: Number(sheetId),
        dimension: "ROWS",
        startIndex: at,
        endIndex: at + count,
      },
      inheritFromBefore: true,
    },
  };
}

function buildInsertDataRowsRequestFromPlan({ sheetId, plan, previousDataRowCount }) {
  const prev = Math.max(0, Number(previousDataRowCount) || 0);
  const next = Math.max(0, Number(plan?.dataRowCount) || 0);
  const prevOverflow = resolveRowOverflowCount(plan, prev);
  const nextOverflow = resolveRowOverflowCount(plan, next);
  const insertCount = Math.max(0, nextOverflow - prevOverflow);
  if (!insertCount) return null;
  const insertAtRow0 = Number(plan.totalTemplateRow) + prevOverflow;
  return buildInsertDataRowsRequest({ sheetId, insertAtRow0, insertCount });
}

function buildDeleteExtraDataRowsRequest({ sheetId, plan, previousDataRowCount }) {
  const prev = Math.max(0, Number(previousDataRowCount) || 0);
  const next = Math.max(0, Number(plan?.dataRowCount) || 0);
  const prevOverflow = resolveRowOverflowCount(plan, prev);
  const nextOverflow = resolveRowOverflowCount(plan, next);
  const deleteCount = Math.max(0, prevOverflow - nextOverflow);
  if (!deleteCount) return null;
  const deleteAtRow0 = Number(plan.totalTemplateRow) + nextOverflow;
  return {
    deleteDimension: {
      range: {
        sheetId: Number(sheetId),
        dimension: "ROWS",
        startIndex: deleteAtRow0,
        endIndex: deleteAtRow0 + deleteCount,
      },
    },
  };
}

function buildTableCellA1({ sheetName, row0, col0 }) {
  const safeSheet = `'${String(sheetName || "Sheet1").replace(/'/g, "''")}'`;
  let n = Number(col0) || 0;
  let col = "";
  while (n >= 0) {
    col = String.fromCharCode((n % 26) + 65) + col;
    n = Math.floor(n / 26) - 1;
  }
  return `${safeSheet}!${col}${Number(row0) + 1}`;
}

async function fetchTemplateRowCellFormats(
  sheetsApi,
  spreadsheetId,
  { sheetTitle, row0, startCol0, colCount },
) {
  const count = Math.max(Number(colCount) || 1, 1);
  const safeSheet = `'${String(sheetTitle || "Sheet1").replace(/'/g, "''")}'`;
  const row1 = Number(row0) + 1;
  const startCol1 = Number(startCol0) + 1;
  const endCol1 = Number(startCol0) + count;
  const range = `${safeSheet}!R${row1}C${startCol1}:R${row1}C${endCol1}`;

  const res = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    ranges: [range],
    includeGridData: true,
    fields: "sheets(data(rowData(values(userEnteredFormat,effectiveFormat))),properties(title)",
  });
  const sheet =
    (res.data.sheets ?? []).find(
      (item) => String(item.properties?.title ?? "") === String(sheetTitle),
    ) ?? res.data.sheets?.[0];
  const values = sheet?.data?.[0]?.rowData?.[0]?.values ?? [];
  const formats = [];
  for (let i = 0; i < count; i += 1) {
    const cell = values[i];
    const fmt = cell?.userEnteredFormat ?? cell?.effectiveFormat;
    formats.push(fmt ? { userEnteredFormat: fmt } : {});
  }
  return formats;
}

async function fetchTemplateTotalRowCellFormats(
  sheetsApi,
  spreadsheetId,
  { sheetTitle, totalTemplateRow0, startCol0, colCount },
) {
  return fetchTemplateRowCellFormats(sheetsApi, spreadsheetId, {
    sheetTitle,
    row0: totalTemplateRow0,
    startCol0,
    colCount,
  });
}

function buildApplyDataRowFormatsRequest({
  sheetId,
  templateRowFormats,
  startRow0,
  dataRowCount,
  startCol0,
}) {
  const count = Math.max(0, Number(dataRowCount) || 0);
  if (!Number.isFinite(Number(sheetId)) || !count || !Array.isArray(templateRowFormats)) {
    return null;
  }
  const startCol = Number(startCol0) || 0;
  const rowValues = templateRowFormats.map((item) =>
    item?.userEnteredFormat ? { userEnteredFormat: item.userEnteredFormat } : {},
  );
  if (!rowValues.length) return null;
  return {
    updateCells: {
      range: {
        sheetId: Number(sheetId),
        startRowIndex: Number(startRow0),
        endRowIndex: Number(startRow0) + count,
        startColumnIndex: startCol,
        endColumnIndex: startCol + rowValues.length,
      },
      rows: Array.from({ length: count }, () => ({ values: rowValues })),
      fields: "userEnteredFormat",
    },
  };
}

function buildApplyTotalRowFormatRequest({ sheetId, totalRow0, startCol0, cellFormats }) {
  if (!Number.isFinite(Number(sheetId)) || !Array.isArray(cellFormats) || !cellFormats.length) {
    return null;
  }
  return {
    updateCells: {
      range: {
        sheetId: Number(sheetId),
        startRowIndex: Number(totalRow0),
        endRowIndex: Number(totalRow0) + 1,
        startColumnIndex: Number(startCol0) || 0,
        endColumnIndex: (Number(startCol0) || 0) + cellFormats.length,
      },
      rows: [
        {
          values: cellFormats.map((item) =>
            item?.userEnteredFormat ? { userEnteredFormat: item.userEnteredFormat } : {},
          ),
        },
      ],
      fields: "userEnteredFormat",
    },
  };
}

function buildTotalRowAmountCellA1({ sheetName, totalRow0, startCol0, columns, amountFieldKey, columnMappings }) {
  const mappings = Array.isArray(columnMappings) ? columnMappings : [];
  const key = String(amountFieldKey ?? "thanhTien").trim() || "thanhTien";
  const fromMapping = mappings.find((item) => item.fieldKey === key);
  if (fromMapping) {
    return buildTableCellA1({
      sheetName,
      row0: totalRow0,
      col0: Number(fromMapping.col),
    });
  }
  const legacyColumns = Array.isArray(columns) ? columns : [];
  const amountIndex = legacyColumns.indexOf(key);
  const amountCol = amountIndex >= 0 ? amountIndex : Math.max(legacyColumns.length - 1, 0);
  return buildTableCellA1({
    sheetName,
    row0: totalRow0,
    col0: (Number(startCol0) || 0) + amountCol,
  });
}

export {
  amountFromRow,
  buildApplyDataRowFormatsRequest,
  buildApplyTotalRowFormatRequest,
  buildCopyTemplateRowFormatRequest,
  resolveOverflowFormatTarget,
  buildCopyTotalRowFormatRequest,
  buildDeleteExtraDataRowsRequest,
  buildDetailTableFillPlan,
  buildInsertDataRowsRequest,
  buildInsertDataRowsRequestFromPlan,
  buildPerRowHeightUpdateRequests,
  buildTableCellA1,
  buildTotalRowAmountCellA1,
  fetchTemplateRowCellFormats,
  fetchTemplateTotalRowCellFormats,
  estimateRowUnits,
  fetchSheetTemplateColumnMeta,
  normalizeSheetTableConfig,
  resolveDataSlotsInTemplate,
  resolveNamedRangeTargetCell,
  resolveRowInsertIndex,
  resolveRowOverflowCount,
  resolveTotalRowIndex,
};
