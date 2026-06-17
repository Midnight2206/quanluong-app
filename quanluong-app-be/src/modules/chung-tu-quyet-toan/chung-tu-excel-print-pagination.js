import { paginateChungTuPrintRows } from "./chung-tu-print-pagination.js";

const A4_PORTRAIT_HEIGHT_IN = 11.69;
const DEFAULT_ROW_HEIGHT_PT = 15;

function inchesToPoints(inches) {
  const n = Number(inches);
  return Number.isFinite(n) && n > 0 ? n * 72 : 0;
}

function resolvePagePrintableHeight(ws, overrides = {}) {
  if (Number.isFinite(Number(overrides.pagePrintableHeight)) && Number(overrides.pagePrintableHeight) > 0) {
    return Number(overrides.pagePrintableHeight);
  }
  const margins = ws.pageMargins ?? {};
  const setup = ws.pageSetup ?? {};
  const top = Number(margins.top) || 0.75;
  const bottom = Number(margins.bottom) || 0.75;
  const header = Number(margins.header) || 0.3;
  const footer = Number(margins.footer) || 0.3;
  let bodyHeight = inchesToPoints(A4_PORTRAIT_HEIGHT_IN - top - bottom - header - footer);
  const scale = Number(setup.scale) || 100;
  if (scale > 0 && scale !== 100) {
    bodyHeight *= 100 / scale;
  }
  return Math.max(120, bodyHeight);
}

function rowHeightPt(ws, rowNumber, fallback = DEFAULT_ROW_HEIGHT_PT) {
  const h = ws.getRow(rowNumber).height;
  return Number.isFinite(h) && h > 0 ? h : fallback;
}

function sumRowHeights(ws, fromRow, toRow, fallback = DEFAULT_ROW_HEIGHT_PT) {
  let sum = 0;
  const start = Math.max(1, fromRow);
  const end = Math.max(start, toRow);
  for (let rowNumber = start; rowNumber <= end; rowNumber += 1) {
    sum += rowHeightPt(ws, rowNumber, fallback);
  }
  return sum;
}

function normalizePaginationConfig(table = {}, pagination = {}) {
  const merged = { ...table, ...pagination };
  return {
    enabled: merged.paginationEnabled !== false && merged.enabled !== false,
    amountFieldKey: String(merged.amountFieldKey ?? "thanhTien").trim() || "thanhTien",
    labelFieldKey: String(merged.labelFieldKey ?? "tenHang").trim() || "tenHang",
    carryInLabel: String(merged.carryInLabel ?? "Mang sang").trim() || "Mang sang",
    carryOutLabel: String(merged.carryOutLabel ?? "Cộng sang trang").trim() || "Cộng sang trang",
    firstPageBodyHeight:
      Number.isFinite(Number(merged.firstPageBodyHeight)) && Number(merged.firstPageBodyHeight) > 0
        ? Number(merged.firstPageBodyHeight)
        : null,
    nextPageBodyHeight:
      Number.isFinite(Number(merged.nextPageBodyHeight)) && Number(merged.nextPageBodyHeight) > 0
        ? Number(merged.nextPageBodyHeight)
        : null,
    carryRowHeight:
      Number.isFinite(Number(merged.carryRowHeight)) && Number(merged.carryRowHeight) > 0
        ? Number(merged.carryRowHeight)
        : null,
    transferRowHeight:
      Number.isFinite(Number(merged.transferRowHeight)) && Number(merged.transferRowHeight) > 0
        ? Number(merged.transferRowHeight)
        : null,
    headerBodyHeight:
      Number.isFinite(Number(merged.headerBodyHeight)) && Number(merged.headerBodyHeight) > 0
        ? Number(merged.headerBodyHeight)
        : null,
    repeatHeaderHeight:
      Number.isFinite(Number(merged.repeatHeaderHeight)) && Number(merged.repeatHeaderHeight) > 0
        ? Number(merged.repeatHeaderHeight)
        : null,
    pagePrintableHeight:
      Number.isFinite(Number(merged.pagePrintableHeight)) && Number(merged.pagePrintableHeight) > 0
        ? Number(merged.pagePrintableHeight)
        : null,
  };
}

function buildColumnMeta(ws, tableMapping) {
  const templateRow = Number(tableMapping.templateRow || tableMapping.startRow) || 9;
  const columnMeta = {};
  for (const col of tableMapping.columns ?? []) {
    if (!col.fieldKey) continue;
    const colNum = Number(col.col);
    if (!Number.isFinite(colNum) || colNum <= 0) continue;
    const column = ws.getColumn(colNum);
    const cell = ws.getRow(templateRow).getCell(colNum);
    columnMeta[col.fieldKey] = {
      col: colNum,
      width: Number(column.width) || 10,
      wrapText: Boolean(cell.alignment?.wrapText),
      fontSize: Number(cell.font?.size) || 11,
    };
  }
  return columnMeta;
}

function buildPrintProfileFromWorksheet(ws, tableMapping, pagination = {}) {
  const cfg = normalizePaginationConfig(tableMapping, pagination);
  const startRow = Number(tableMapping.startRow) || 9;
  const headerRow = Number(tableMapping.headerRow) || Math.max(1, startRow - 1);
  const templateRow = Number(tableMapping.templateRow) || startRow;
  const dataRowHeight = rowHeightPt(ws, templateRow);
  const printableHeight = resolvePagePrintableHeight(ws, cfg);
  const headerBodyHeight = cfg.headerBodyHeight ?? sumRowHeights(ws, 1, Math.max(1, startRow - 1), dataRowHeight);
  const repeatHeaderHeight = cfg.repeatHeaderHeight ?? rowHeightPt(ws, headerRow, dataRowHeight);
  const carryRowHeight = cfg.carryRowHeight ?? dataRowHeight;
  const transferRowHeight = cfg.transferRowHeight ?? carryRowHeight;

  const firstPageBodyHeight =
    cfg.firstPageBodyHeight ?? Math.max(carryRowHeight + dataRowHeight, printableHeight - headerBodyHeight);
  const nextPageBodyHeight =
    cfg.nextPageBodyHeight ?? Math.max(carryRowHeight + dataRowHeight, printableHeight - repeatHeaderHeight);

  return {
    ...cfg,
    firstPageBodyHeight,
    nextPageBodyHeight,
    carryRowHeight,
    transferRowHeight,
    dataRowHeight,
    columnMeta: buildColumnMeta(ws, tableMapping),
    printableHeight,
    headerBodyHeight,
    repeatHeaderHeight,
  };
}

function estimateCharsPerLine(columnWidth) {
  const w = Number(columnWidth) || 10;
  return Math.max(1, Math.floor(w * 0.85));
}

function estimateRowHeight(row, printProfile) {
  const baseHeight = printProfile.dataRowHeight || DEFAULT_ROW_HEIGHT_PT;
  const colMeta = printProfile.columnMeta ?? {};
  let maxLines = 1;

  for (const fieldKey of Object.keys(colMeta)) {
    const meta = colMeta[fieldKey];
    const text = String(row?.[fieldKey] ?? "");
    if (!text) continue;
    const charsPerLine = estimateCharsPerLine(meta.width);
    const lines = meta.wrapText ? Math.max(1, Math.ceil(text.length / charsPerLine)) : 1;
    maxLines = Math.max(maxLines, lines);
  }

  if (maxLines <= 1) return baseHeight;
  const lineHeight = Math.max(baseHeight * 0.82, 12);
  return Math.max(baseHeight, maxLines * lineHeight);
}

function buildCarryDetailRow({ kind, amount, label, labelFieldKey, amountFieldKey }) {
  return {
    __carryRow: kind,
    [labelFieldKey]: label,
    [amountFieldKey]: amount,
  };
}

function expandDetailRowsWithCarryRows(detailRows, printProfile) {
  if (!printProfile?.enabled) return Array.isArray(detailRows) ? detailRows : [];
  const rows = Array.isArray(detailRows) ? detailRows : [];
  if (!rows.length) return rows;

  const pages = paginateChungTuPrintRows({
    rows,
    firstPageBodyHeight: printProfile.firstPageBodyHeight,
    nextPageBodyHeight: printProfile.nextPageBodyHeight,
    rowHeight: (row) => estimateRowHeight(row, printProfile),
    carryRowHeight: printProfile.carryRowHeight,
    transferRowHeight: printProfile.transferRowHeight,
    amountFieldKey: printProfile.amountFieldKey,
  });

  const out = [];
  for (const page of pages) {
    if (page.carryIn > 0) {
      out.push(
        buildCarryDetailRow({
          kind: "carry-in",
          amount: page.carryIn,
          label: printProfile.carryInLabel,
          labelFieldKey: printProfile.labelFieldKey,
          amountFieldKey: printProfile.amountFieldKey,
        }),
      );
    }
    out.push(...page.rows);
    if (page.carryOut != null) {
      out.push(
        buildCarryDetailRow({
          kind: "carry-out",
          amount: page.carryOut,
          label: printProfile.carryOutLabel,
          labelFieldKey: printProfile.labelFieldKey,
          amountFieldKey: printProfile.amountFieldKey,
        }),
      );
    }
  }
  return out;
}

function isCarryDetailRow(row) {
  return row && typeof row === "object" && (row.__carryRow === "carry-in" || row.__carryRow === "carry-out");
}

export {
  buildPrintProfileFromWorksheet,
  estimateRowHeight,
  expandDetailRowsWithCarryRows,
  isCarryDetailRow,
  normalizePaginationConfig,
};
