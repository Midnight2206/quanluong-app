import {
  amountFromRow,
  buildChungTuSheetPrintRows,
  paginateChungTuPrintRows,
} from "./chung-tu-print-pagination.js";
import { CHUNG_TU_DEFAULT_SHEET_PRINT } from "./chung-tu-category.constants.js";

function estimateCharsPerLine(columnWidthPx) {
  const w = Number(columnWidthPx) || 72;
  return Math.max(1, Math.floor(w / 7));
}

function isWrapEnabled(format) {
  const strategy = format?.wrapStrategy ?? format?.userEnteredFormat?.wrapStrategy;
  return strategy === "WRAP" || strategy === "LEGACY_WRAP";
}

function normalizeSheetPrintConfig(tableCfg = {}, printSheets = {}) {
  const merged = { ...printSheets, ...tableCfg };
  const rowsPerPage =
    Number.isFinite(Number(merged.rowsPerPage)) && Number(merged.rowsPerPage) > 0
      ? Number(merged.rowsPerPage)
      : Number.isFinite(Number(merged.pageRowsFirst)) && Number(merged.pageRowsFirst) > 0
        ? Number(merged.pageRowsFirst)
        : CHUNG_TU_DEFAULT_SHEET_PRINT.rowsPerPage;
  const rowHeightPt =
    Number.isFinite(Number(merged.rowHeightPt)) && Number(merged.rowHeightPt) > 0
      ? Number(merged.rowHeightPt)
      : CHUNG_TU_DEFAULT_SHEET_PRINT.rowHeightPt;

  return {
    enabled: merged.paginationEnabled !== false && merged.enabled !== false,
    rowsPerPage,
    rowHeightPt,
    amountFieldKey: String(merged.amountFieldKey ?? "thanhTien").trim() || "thanhTien",
    labelFieldKey: String(merged.labelFieldKey ?? "tenHang").trim() || "tenHang",
    carryInLabel: String(merged.carryInLabel ?? "Mang sang").trim() || "Mang sang",
    carryOutLabel: String(merged.carryOutLabel ?? "Cộng sang trang").trim() || "Cộng sang trang",
    templateRow:
      Number.isFinite(Number(merged.templateRow)) && Number(merged.templateRow) >= 0
        ? Number(merged.templateRow)
        : Number.isFinite(Number(merged.startRow))
          ? Number(merged.startRow)
          : 8,
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

function buildCarryDetailRow({ kind, amount, label, labelFieldKey, amountFieldKey }) {
  return {
    __carryRow: kind,
    [labelFieldKey]: label,
    [amountFieldKey]: amount,
  };
}

function buildPaddingDetailRow() {
  return { __padding: true };
}

function computePlacedRowSpan(pages, rowsPerPage) {
  if (!pages.length) return 0;
  let span = 0;
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    if (page.carryOut != null) {
      span += rowsPerPage;
    } else {
      const dataStart = i > 0 ? 1 : 0;
      span = i * rowsPerPage + dataStart + page.rows.length;
    }
  }
  return span;
}

function buildDenseGridFromPlacements(placements, totalRowSpan, columns) {
  const colCount = Math.max(columns.length, 1);
  const span = Math.max(Number(totalRowSpan) || 0, 0);
  const values = Array.from({ length: span }, () => Array(colCount).fill(""));
  const rowLineUnits = Array.from({ length: span }, () => 1);
  for (const placement of placements ?? []) {
    const offset = Number(placement.rowOffset);
    if (!Number.isFinite(offset) || offset < 0 || offset >= span) continue;
    values[offset] = placement.values;
    rowLineUnits[offset] = Math.max(1, Number(placement.lineUnits) || 1);
  }
  return { values, rowLineUnits };
}

/** Gán dòng vào ô thực tế trên lưới 40 hàng/trang; wrap trừ ngân sách trang, mỗi mục dữ liệu = 1 hàng sheet. */
function buildPaginatedPlacements(detailRows, printProfile, columns) {
  const rows = Array.isArray(detailRows) ? detailRows : [];
  const cols = (Array.isArray(columns) ? columns : []).filter(Boolean);
  if (!rows.length || !cols.length) {
    return { placements: [], totalRowSpan: 0, pages: [] };
  }

  const rowsPerPage = printProfile.rowsPerPage;
  const columnMeta = printProfile.columnMeta ?? {};
  const pages = paginateChungTuPrintRows({
    rows,
    firstPageBodyHeight: rowsPerPage,
    nextPageBodyHeight: rowsPerPage,
    rowHeight: (row) => estimateRowUnits(row, cols, columnMeta),
    carryRowHeight: 1,
    transferRowHeight: 1,
    amountFieldKey: printProfile.amountFieldKey,
  });

  const placements = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const pageBase = pageIndex * rowsPerPage;
    let nextOffset = pageBase;

    if (page.carryIn > 0) {
      const carryRow = buildCarryDetailRow({
        kind: "carry-in",
        amount: page.carryIn,
        label: printProfile.carryInLabel,
        labelFieldKey: printProfile.labelFieldKey,
        amountFieldKey: printProfile.amountFieldKey,
      });
      placements.push({
        rowOffset: nextOffset,
        values: detailRowToCells(carryRow, cols),
        lineUnits: 1,
      });
      nextOffset += 1;
    }

    for (let i = 0; i < page.rows.length; i += 1) {
      const row = page.rows[i];
      const lineUnits = Math.max(
        1,
        Number(page.rowHeights?.[i]) ||
          rowLineUnitsForOutputRow(row, cols, columnMeta),
      );
      placements.push({
        rowOffset: nextOffset,
        values: detailRowToCells(row, cols),
        lineUnits,
      });
      nextOffset += 1;
    }

    if (page.carryOut != null) {
      const carryOutOffset = pageBase + rowsPerPage - 1;
      while (nextOffset < carryOutOffset) {
        placements.push({
          rowOffset: nextOffset,
          values: detailRowToCells(buildPaddingDetailRow(), cols),
          lineUnits: 1,
        });
        nextOffset += 1;
      }
      const carryRow = buildCarryDetailRow({
        kind: "carry-out",
        amount: page.carryOut,
        label: printProfile.carryOutLabel,
        labelFieldKey: printProfile.labelFieldKey,
        amountFieldKey: printProfile.amountFieldKey,
      });
      placements.push({
        rowOffset: carryOutOffset,
        values: detailRowToCells(carryRow, cols),
        lineUnits: 1,
      });
    }
  }

  return {
    placements,
    totalRowSpan: computePlacedRowSpan(pages, rowsPerPage),
    pages,
  };
}

function expandDetailRowsWithCarryRows(detailRows, printProfile, columns) {
  if (!printProfile?.enabled) return Array.isArray(detailRows) ? detailRows : [];
  const { placements } = buildPaginatedPlacements(detailRows, printProfile, columns);
  return placements
    .slice()
    .sort((a, b) => a.rowOffset - b.rowOffset)
    .map((p) => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = p.values[idx];
      });
      const label = p.values[columns.indexOf(printProfile.labelFieldKey)] ?? "";
      const amount = p.values[columns.indexOf(printProfile.amountFieldKey)];
      if (label === printProfile.carryInLabel) {
        obj.__carryRow = "carry-in";
      } else if (label === printProfile.carryOutLabel) {
        obj.__carryRow = "carry-out";
      }
      return obj;
    });
}

function detailRowToCells(row, columns) {
  if (row?.__padding) {
    return columns.map(() => "");
  }
  return columns.map((col) => {
    const v = row?.[col];
    if (v == null) return "";
    return v;
  });
}

function buildDetailTableValues({ detailRows, columns }) {
  return detailRows.map((row) => detailRowToCells(row, columns));
}

function buildChungTuSheetPrintRowsWithWrap({ detailRows, columns, printProfile }) {
  const cols = (Array.isArray(columns) ? columns : []).filter(Boolean);
  const rows = Array.isArray(detailRows) ? detailRows : [];
  if (!cols.length || !rows.length) {
    return {
      values: [],
      expandedRows: [],
      rowLineUnits: [],
      placements: [],
      totalRowSpan: 0,
    };
  }

  if (!printProfile?.enabled) {
    const values = buildDetailTableValues({ detailRows: rows, columns: cols });
    return {
      values,
      expandedRows: rows,
      rowLineUnits: rows.map(() => 1),
      placements: rows.map((row, index) => ({
        rowOffset: index,
        values: detailRowToCells(row, cols),
        lineUnits: 1,
      })),
      totalRowSpan: rows.length,
    };
  }

  const { placements, totalRowSpan } = buildPaginatedPlacements(rows, printProfile, cols);
  const dense = buildDenseGridFromPlacements(placements, totalRowSpan, cols);
  return {
    values: dense.values,
    expandedRows: dense.values,
    rowLineUnits: dense.rowLineUnits,
    placements,
    totalRowSpan,
  };
}

function rowLineUnitsForOutputRow(row, columns, columnMeta) {
  if (row?.__carryRow || row?.__padding) return 1;
  return estimateRowUnits(row, columns, columnMeta);
}

function buildSheetPrintOutput({ detailRows, columns, tableCfg, printSheets }) {
  const printProfile = normalizeSheetPrintConfig(tableCfg, printSheets);
  if (printSheets?.columnMeta) {
    printProfile.columnMeta = printSheets.columnMeta;
  }
  const cols = (Array.isArray(columns) ? columns : []).filter(Boolean);
  const rows = Array.isArray(detailRows) ? detailRows : [];

  const pageRowsFirst = Number(tableCfg?.pageRowsFirst);
  const pageRowsNext = Number(tableCfg?.pageRowsNext);
  if (!printProfile.enabled && pageRowsFirst > 0 && pageRowsNext > 0) {
    const values = buildChungTuSheetPrintRows({
      detailRows: rows,
      columns: cols,
      pageRowsFirst,
      pageRowsNext,
      amountFieldKey: printProfile.amountFieldKey,
      labelFieldKey: printProfile.labelFieldKey,
      carryInLabel: printProfile.carryInLabel,
      carryOutLabel: printProfile.carryOutLabel,
    });
    return {
      values,
      rowLineUnits: values.map(() => 1),
      printProfile,
    };
  }

  if (printProfile.enabled) {
    const wrapped = buildChungTuSheetPrintRowsWithWrap({
      detailRows: rows,
      columns: cols,
      printProfile: {
        ...printProfile,
        columnMeta: printProfile.columnMeta ?? {},
      },
    });
    return {
      mode: "contiguous",
      placements: wrapped.placements,
      totalRowSpan: wrapped.totalRowSpan,
      values: wrapped.values,
      rowLineUnits: wrapped.rowLineUnits,
      printProfile,
    };
  }

  const values = buildDetailTableValues({ detailRows: rows, columns: cols });
  return {
    mode: "contiguous",
    values,
    rowLineUnits: values.map(() => 1),
    totalRowSpan: values.length,
    printProfile,
  };
}

function buildChungTuSheetPrintRowsLegacyOrWrap({ detailRows, columns, tableCfg, printSheets }) {
  return buildSheetPrintOutput({ detailRows, columns, tableCfg, printSheets }).values;
}

/** Vị trí ngắt trang (0-based row index) — mỗi đúng rowsPerPage dòng dữ liệu từ startRow. */
function collectSheetPageBreakRowIndices({ startRow0, outputRowCount, rowsPerPage }) {
  const start = Number(startRow0) || 0;
  const count = Number(outputRowCount) || 0;
  const step = Number(rowsPerPage) || CHUNG_TU_DEFAULT_SHEET_PRINT.rowsPerPage;
  const indices = [];
  for (let offset = step; offset < count; offset += step) {
    indices.push(start + offset);
  }
  return indices;
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

function buildRowHeightUpdateRequests({ sheetId, startRow0, rowCount, rowHeightPt }) {
  if (!Number.isFinite(Number(sheetId)) || !rowCount || rowCount <= 0) return [];
  const pixelSize = ptToPixelSize(rowHeightPt);
  return [
    {
      updateDimensionProperties: {
        range: {
          sheetId: Number(sheetId),
          dimension: "ROWS",
          startIndex: Number(startRow0),
          endIndex: Number(startRow0) + Number(rowCount),
        },
        properties: { pixelSize },
        fields: "pixelSize",
      },
    },
  ];
}

/** Mỗi dòng wrap thêm 1 unit → chiều cao hàng = units × rowHeightPt. */
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

/** Chiều cao từng hàng theo vị trí tuyệt đối (0-based). */
function buildPerRowHeightUpdateRequestsFromPlacements({ sheetId, placements, rowHeightPt }) {
  if (!Number.isFinite(Number(sheetId)) || !Array.isArray(placements) || !placements.length) {
    return [];
  }
  const basePt = Number(rowHeightPt) || CHUNG_TU_DEFAULT_SHEET_PRINT.rowHeightPt;
  const requests = [];
  for (const p of placements) {
    const absoluteRow0 = Number(p.absoluteRow0);
    if (!Number.isFinite(absoluteRow0)) continue;
    const units = Math.max(1, Number(p.lineUnits) || 1);
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId: Number(sheetId),
          dimension: "ROWS",
          startIndex: absoluteRow0,
          endIndex: absoluteRow0 + 1,
        },
        properties: { pixelSize: ptToPixelSize(basePt * units) },
        fields: "pixelSize",
      },
    });
  }
  return requests;
}

function buildAutoResizeRowsRequest({ sheetId, startRow0, rowCount }) {
  if (!Number.isFinite(Number(sheetId)) || !rowCount || rowCount <= 0) return null;
  return {
    autoResizeDimensions: {
      dimensions: {
        sheetId: Number(sheetId),
        dimension: "ROWS",
        startIndex: Number(startRow0),
        endIndex: Number(startRow0) + Number(rowCount),
      },
    },
  };
}

function buildWrapTextRepeatCellRequest({ sheetId, startRow0, startCol0, rowCount, colCount }) {
  if (!Number.isFinite(Number(sheetId)) || !rowCount || !colCount) return null;
  return {
    repeatCell: {
      range: {
        sheetId: Number(sheetId),
        startRowIndex: Number(startRow0),
        endRowIndex: Number(startRow0) + Number(rowCount),
        startColumnIndex: Number(startCol0),
        endColumnIndex: Number(startCol0) + Number(colCount),
      },
      cell: {
        userEnteredFormat: {
          wrapStrategy: "WRAP",
          verticalAlignment: "TOP",
        },
      },
      fields: "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment",
    },
  };
}

export {
  amountFromRow,
  buildAutoResizeRowsRequest,
  buildChungTuSheetPrintRowsLegacyOrWrap,
  buildChungTuSheetPrintRowsWithWrap,
  buildColumnMetaFromGridData,
  buildDenseGridFromPlacements,
  buildPerRowHeightUpdateRequests,
  buildPaginatedPlacements,
  buildPerRowHeightUpdateRequestsFromPlacements,
  buildSheetPrintOutput,
  buildWrapTextRepeatCellRequest,
  collectSheetPageBreakRowIndices,
  estimateRowUnits,
  expandDetailRowsWithCarryRows,
  fetchSheetTemplateColumnMeta,
  normalizeSheetPrintConfig,
  buildRowHeightUpdateRequests,
  rowLineUnitsForOutputRow,
};
