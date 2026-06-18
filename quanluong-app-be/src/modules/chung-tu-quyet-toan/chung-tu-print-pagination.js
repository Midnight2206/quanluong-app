function parseVietnameseNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function amountFromRow(row, amountFieldKey) {
  if (!row || typeof row !== "object") return 0;
  if (amountFieldKey && Object.prototype.hasOwnProperty.call(row, amountFieldKey)) {
    return parseVietnameseNumber(row[amountFieldKey]);
  }
  if (Object.prototype.hasOwnProperty.call(row, "thanhTienSo")) {
    return parseVietnameseNumber(row.thanhTienSo);
  }
  return parseVietnameseNumber(row.thanhTien);
}

function resolveRowHeight(rowHeight, row, index) {
  if (typeof rowHeight === "function") {
    const h = Number(rowHeight(row, index));
    return Number.isFinite(h) && h > 0 ? h : 20;
  }
  const h = Number(rowHeight);
  return Number.isFinite(h) && h > 0 ? h : 20;
}

function emptyPage() {
  return {
    pageIndex: 0,
    carryIn: 0,
    pageAmount: 0,
    carryOut: null,
    rows: [],
    rowHeights: [],
  };
}

function paginateChungTuPrintRows({
  rows,
  firstPageBodyHeight,
  nextPageBodyHeight,
  rowHeight = 20,
  carryRowHeight = 20,
  transferRowHeight = 20,
  amountFieldKey = "thanhTien",
}) {
  const measured = (Array.isArray(rows) ? rows : []).map((row, index) => ({
    row,
    height: resolveRowHeight(rowHeight, row, index),
    amount: amountFromRow(row, amountFieldKey),
  }));
  if (!measured.length) {
    return [emptyPage()];
  }

  const firstLimit = Math.max(1, Number(firstPageBodyHeight) || 1);
  const nextLimit = Math.max(1, Number(nextPageBodyHeight) || firstLimit);
  const carryHeight = Math.max(0, Number(carryRowHeight) || 0);
  const transferHeight = Math.max(0, Number(transferRowHeight) || 0);
  const pages = [];
  let index = 0;
  let carryIn = 0;

  while (index < measured.length) {
    const pageIndex = pages.length;
    const limit = pageIndex === 0 ? firstLimit : nextLimit;
    const pageRows = [];
    const rowHeights = [];
    let pageAmount = 0;
    let occupied = carryIn > 0 ? carryHeight : 0;

    while (index < measured.length) {
      const item = measured[index];
      const hasMoreAfterThis = index < measured.length - 1;
      const reserveTransfer = hasMoreAfterThis ? transferHeight : 0;
      const fits = occupied + item.height + reserveTransfer <= limit;
      if (!fits && pageRows.length > 0) break;
      pageRows.push(item.row);
      rowHeights.push(item.height);
      pageAmount += item.amount;
      occupied += item.height;
      index += 1;
    }

    const hasNextPage = index < measured.length;
    const carryOut = hasNextPage ? carryIn + pageAmount : null;
    pages.push({
      pageIndex,
      carryIn,
      pageAmount,
      carryOut,
      rows: pageRows,
      rowHeights,
    });
    carryIn = carryOut ?? 0;
  }

  return pages;
}

function detailRowToCells(row, columns) {
  return columns.map((col) => {
    const v = row?.[col];
    return v == null ? "" : v;
  });
}

function buildCarrySheetRow({ columns, labelFieldKey, amountFieldKey, label, amount }) {
  const row = columns.map(() => "");
  const labelIndex = Math.max(0, columns.indexOf(labelFieldKey));
  const amountIndex = columns.indexOf(amountFieldKey);
  row[labelIndex] = label;
  row[amountIndex >= 0 ? amountIndex : row.length - 1] = amount;
  return row;
}

/** Phân trang cố định theo số dòng/lưới (40 dòng/trang), không theo chiều cao wrap. */
function paginateChungTuSheetFixedRows({
  rows,
  rowsPerPage,
  amountFieldKey = "thanhTien",
}) {
  const data = Array.isArray(rows) ? rows : [];
  const pageSize = Math.max(1, Number(rowsPerPage) || 1);

  if (!data.length) {
    return [
      {
        pageIndex: 0,
        carryIn: 0,
        pageAmount: 0,
        carryOut: null,
        rows: [],
      },
    ];
  }

  const pages = [];
  let index = 0;
  let carryIn = 0;

  while (index < data.length) {
    const pageIndex = pages.length;
    let maxData = pageSize;
    if (pageIndex > 0) maxData -= 1;
    const willHaveNext = index + maxData < data.length;
    if (willHaveNext) maxData -= 1;
    maxData = Math.max(1, maxData);

    const pageRows = data.slice(index, index + maxData);
    const pageAmount = pageRows.reduce((sum, row) => sum + amountFromRow(row, amountFieldKey), 0);
    index += pageRows.length;
    const hasContinuation = index < data.length;
    const carryOut = hasContinuation ? carryIn + pageAmount : null;

    pages.push({
      pageIndex,
      carryIn,
      pageAmount,
      carryOut,
      rows: pageRows,
    });
    carryIn = carryOut ?? 0;
  }

  return pages;
}

function buildChungTuSheetPrintRows({
  detailRows,
  columns,
  pageRowsFirst = 0,
  pageRowsNext = 0,
  amountFieldKey = "thanhTien",
  labelFieldKey = "tenHang",
  carryInLabel = "Mang sang",
  carryOutLabel = "Cộng sang trang",
}) {
  const rows = Array.isArray(detailRows) ? detailRows : [];
  const cols = (Array.isArray(columns) ? columns : []).filter(Boolean);
  if (!cols.length || !rows.length) return [];
  const firstRows = Number(pageRowsFirst);
  const nextRows = Number(pageRowsNext);
  if (!Number.isInteger(firstRows) || firstRows <= 0 || !Number.isInteger(nextRows) || nextRows <= 0) {
    return rows.map((row) => detailRowToCells(row, cols));
  }

  const pages = [];
  let index = 0;
  let carryIn = 0;
  while (index < rows.length) {
    const pageIndex = pages.length;
    const pageSize = pageIndex === 0 ? firstRows : nextRows;
    const hasNextPage = index < rows.length; // tentative
    let maxData = pageSize;
    if (pageIndex > 0) maxData -= 1;
    const willHaveNext = index + maxData < rows.length;
    if (willHaveNext) maxData -= 1;
    maxData = Math.max(1, maxData);
    const pageRows = rows.slice(index, index + maxData);
    const pageAmount = pageRows.reduce((sum, row) => sum + amountFromRow(row, amountFieldKey), 0);
    index += pageRows.length;
    const hasContinuation = index < rows.length;
    const carryOut = hasContinuation ? carryIn + pageAmount : null;
    pages.push({
      pageIndex,
      pageSize,
      carryIn,
      carryOut,
      rows: pageRows,
    });
    carryIn = carryOut ?? 0;
  }
  const values = [];
  for (const page of pages) {
    const hasNextPage = page.carryOut != null;
    const pageBlock = [];

    if (page.carryIn > 0) {
      pageBlock.push(
        buildCarrySheetRow({
          columns: cols,
          labelFieldKey,
          amountFieldKey,
          label: carryInLabel,
          amount: page.carryIn,
        }),
      );
    }
    for (const row of page.rows) {
      pageBlock.push(detailRowToCells(row, cols));
    }
    if (hasNextPage) {
      while (pageBlock.length < page.pageSize - 1) {
        pageBlock.push(cols.map(() => ""));
      }
      pageBlock.push(
        buildCarrySheetRow({
          columns: cols,
          labelFieldKey,
          amountFieldKey,
          label: carryOutLabel,
          amount: page.carryOut,
        }),
      );
    }
    values.push(...pageBlock);
  }
  return values;
}

export {
  amountFromRow,
  buildChungTuSheetPrintRows,
  paginateChungTuPrintRows,
  paginateChungTuSheetFixedRows,
  parseVietnameseNumber,
};
