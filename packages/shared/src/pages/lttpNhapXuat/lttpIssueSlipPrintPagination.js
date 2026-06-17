function lineAmount(line) {
  const a = Number(line?.amount);
  return Number.isFinite(a) ? a : 0;
}

/** ~11 dòng dữ liệu trang 1 @ 12pt (có header + người nhận). */
const FIRST_PAGE_ROWS_AT_12PT = 11;
const NEXT_PAGE_ROWS_AT_12PT = 16;
const LAST_PAGE_FOOTER_ROWS_FIRST = 6;
const LAST_PAGE_FOOTER_ROWS_NEXT = 8;

function rowLimits(fontSizePt = 12) {
  const scale = Math.max(0.75, fontSizePt / 12);
  return {
    firstMax: Math.max(6, Math.floor(FIRST_PAGE_ROWS_AT_12PT / scale)),
    nextMax: Math.max(8, Math.floor(NEXT_PAGE_ROWS_AT_12PT / scale)),
  };
}

/**
 * Chia dòng bảng — mỗi khối vừa một trang A4 dọc @ 100% (không co font).
 */
export function paginateIssueSlipPrintLines(lines, fontSizePt = 12) {
  const rows = lines ?? [];
  const { firstMax, nextMax } = rowLimits(fontSizePt);

  if (!rows.length) {
    return [
      {
        pageIndex: 0,
        isFirstPage: true,
        isLastPage: true,
        carryIn: 0,
        transferOut: null,
        rows: [],
        sttStart: 1,
      },
    ];
  }

  const pages = [];
  let index = 0;
  let pageIndex = 0;
  let carryIn = 0;

  while (index < rows.length) {
    const isFirstPage = pageIndex === 0;
    const maxBody = isFirstPage ? firstMax : nextMax;
    const pageRows = [];
    let occupied = 0;

    while (index < rows.length) {
      const left = rows.length - index;
      const needTransfer = left > 1 ? 1 : 0;
      if (occupied + 1 + needTransfer <= maxBody || pageRows.length === 0) {
        pageRows.push(rows[index]);
        occupied += 1;
        index += 1;
        continue;
      }
      break;
    }

    if (index < rows.length && rows.length - index === 1 && pageRows.length > 2) {
      pageRows.pop();
      index -= 1;
    }

    const pageAmount = pageRows.reduce((sum, row) => sum + lineAmount(row), 0);
    const hasNextPage = index < rows.length;

    pages.push({
      pageIndex,
      isFirstPage,
      isLastPage: !hasNextPage,
      carryIn,
      transferOut: hasNextPage ? carryIn + pageAmount : null,
      rows: pageRows,
      sttStart: index - pageRows.length + 1,
    });

    carryIn = hasNextPage ? carryIn + pageAmount : 0;
    pageIndex += 1;
  }

  ensureLastPageHasFooterSpace(pages, fontSizePt);

  return pages.map((page, i) => ({
    ...page,
    pageIndex: i,
    isLastPage: i === pages.length - 1,
    transferOut: i < pages.length - 1 ? recalcTransferOut(pages, i) : null,
  }));
}

function recalcTransferOut(pages, pageIdx) {
  const page = pages[pageIdx];
  return page.carryIn + page.rows.reduce((sum, row) => sum + lineAmount(row), 0);
}

function ensureLastPageHasFooterSpace(pages, fontSizePt) {
  if (!pages.length) return;
  const { firstMax, nextMax } = rowLimits(fontSizePt);

  while (pages.length) {
    const lastIdx = pages.length - 1;
    const last = pages[lastIdx];
    const reserve = last.isFirstPage
      ? LAST_PAGE_FOOTER_ROWS_FIRST
      : LAST_PAGE_FOOTER_ROWS_NEXT;
    const pageCap = last.isFirstPage ? firstMax : nextMax;
    const maxDataRows = Math.max(2, pageCap - reserve);

    if (last.rows.length <= maxDataRows || last.rows.length <= 2) {
      break;
    }

    const moved = last.rows.splice(maxDataRows);
    if (!moved.length) break;

    const lastAmount = last.rows.reduce((sum, row) => sum + lineAmount(row), 0);
    last.transferOut = lastAmount + last.carryIn;

    let next = pages[lastIdx + 1];
    if (!next) {
      next = {
        pageIndex: lastIdx + 1,
        isFirstPage: false,
        isLastPage: true,
        carryIn: last.transferOut,
        transferOut: null,
        rows: [],
        sttStart: last.sttStart + last.rows.length,
      };
      pages.push(next);
    } else {
      next.carryIn = last.transferOut;
      next.sttStart = last.sttStart + last.rows.length;
    }
    next.rows = [...moved, ...next.rows];
  }
}
