import { splitLedgerPages } from "./kitchen-ledger-compute.js";
import { toScaled } from "./kitchen-ledger-decimal.js";
import { LEDGER_PRINT_LAYOUT } from "./kitchen-ledger-layout.js";

const DASH = "\u2013";
const MEAL_LABEL = { sang: "Sáng", trua: "Trưa", chieu: "Chiều" };
const EXTRA_LABEL = {
  benhXa: "Bệnh xá",
  benhNhan: "Bệnh nhân",
  omTrai: "Ốm tại trại",
  leTet: "Lễ, tết:",
};

/** Cùng quy tắc packages/shared ledgerNumberFormat — BE không import package web. */
function formatLedgerNumber(value, { blankZero = true } = {}) {
  if (value == null || value === "") return blankZero ? "" : "0";
  const raw = String(value).trim().replace(/\s/g, "");
  if (!raw) return blankZero ? "" : "0";
  const neg = raw.startsWith("-");
  let body = neg ? raw.slice(1) : raw;
  if (body.includes(",")) body = body.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(body)) return String(value);
  const [intPart, frac = ""] = body.split(".");
  const intNorm = intPart.replace(/^0+(?=\d)/, "") || "0";
  const fracTrim = frac.replace(/0+$/, "");
  if (blankZero && !neg && intNorm === "0" && !fracTrim) return "";
  const grouped = intNorm.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const shown = fracTrim ? `${grouped},${fracTrim}` : grouped;
  return neg ? `-${shown}` : shown;
}

function hasMoney(value) {
  return toScaled(value ?? 0) !== 0n;
}

function qtyCell(line, qtyField, amountField) {
  if (line.displayDash && hasMoney(line[amountField])) return DASH;
  return formatLedgerNumber(line[qtyField]);
}

function moneyFields(source) {
  return {
    openingAmount: formatLedgerNumber(source?.openingAmount),
    inAmount: formatLedgerNumber(source?.inAmount),
    totalInAmount: formatLedgerNumber(source?.totalInAmount),
    mealAmount: formatLedgerNumber(source?.mealAmount),
    otherAmount: formatLedgerNumber(source?.otherAmount),
    totalOutAmount: formatLedgerNumber(source?.totalOutAmount),
  };
}

function formatRow(line, stt) {
  return {
    stt: String(stt),
    name: line.name ?? "",
    uom: line.uom ?? "",
    price: line.displayDash ? "" : formatLedgerNumber(line.unitPrice, { blankZero: false }),
    openingQty: qtyCell(line, "openingQty", "openingAmount"),
    openingAmount: formatLedgerNumber(line.openingAmount),
    inG: formatLedgerNumber(line.inG),
    inH: formatLedgerNumber(line.inH),
    inI: qtyCell(line, "inI", "inAmount"),
    inJ: formatLedgerNumber(line.inJ),
    inAmount: formatLedgerNumber(line.inAmount),
    totalInQty: qtyCell(line, "totalInQty", "totalInAmount"),
    totalInAmount: formatLedgerNumber(line.totalInAmount),
    mealQty: qtyCell(line, "mealQty", "mealAmount"),
    mealAmount: formatLedgerNumber(line.mealAmount),
    otherQty: formatLedgerNumber(line.otherQty),
    otherAmount: formatLedgerNumber(line.otherAmount),
    totalOutQty: qtyCell(line, "totalOutQty", "totalOutAmount"),
    totalOutAmount: formatLedgerNumber(line.totalOutAmount),
  };
}

function sheetsFromLines(lines, totals) {
  const pages = splitLedgerPages(lines || []);
  let stt = 1;
  return pages.map((page, index) => {
    const last = index === pages.length - 1;
    const prevCarry = index > 0 ? pages[index - 1].carry : null;
    return {
      rows: page.lines.map((line) => formatRow(line, stt++)),
      carryIn: prevCarry ? moneyFields(prevCarry) : null,
      carryOut: page.carry ? moneyFields(page.carry) : null,
      showTotal: last,
      showSignature: last,
      totals: last ? moneyFields(totals) : null,
    };
  });
}

function expr(count, price, amount) {
  if (!hasMoney(count) && !hasMoney(amount)) return "";
  const left = formatLedgerNumber(count, { blankZero: false });
  const mid = formatLedgerNumber(price, { blankZero: false });
  const right = formatLedgerNumber(amount, { blankZero: false });
  return `${left} x ${mid} = ${right}`;
}

function financeRow(label, value, tone) {
  return { label, value, tone };
}

function financeLines(finance) {
  if (!finance) return [];
  const lines = [financeRow("Thu", "", "heading")];
  for (const level of finance.levels || []) {
    lines.push(financeRow("- Mức:", formatLedgerNumber(level.dailyAmount, { blankZero: false }), "line"));
    for (const meal of level.meals || []) {
      lines.push(financeRow(
        `+ ${MEAL_LABEL[meal.meal] || meal.meal}:`,
        expr(meal.headcount, meal.price, meal.amount),
        "line",
      ));
    }
  }
  lines.push(financeRow("Ăn thêm", "", "heading"));
  for (const extra of finance.extras || []) {
    lines.push(financeRow(
      `+ ${EXTRA_LABEL[extra.key] || extra.key}`,
      expr(extra.count, extra.rate, extra.amount),
      "line",
    ));
  }
  const other = finance.otherIncome || {};
  lines.push(
    financeRow("Cộng:", formatLedgerNumber(finance.subtotal), "total"),
    financeRow("- Thừa hôm trước", formatLedgerNumber(finance.prevSurplus), "line"),
    financeRow("- Bù giá gạo:", formatLedgerNumber(finance.riceSubsidy), "line"),
    financeRow("- Ăn thêm:", formatLedgerNumber(other.anThem), "line"),
    financeRow("- Truy lĩnh:", formatLedgerNumber(other.truyLinh), "line"),
    financeRow("- Thu của khách:", formatLedgerNumber(other.thuKhach), "line"),
    financeRow("Cộng thu:", formatLedgerNumber(finance.totalIncome), "total"),
    financeRow("Chi", "", "heading"),
    financeRow("- Tiền đã sử dụng:", formatLedgerNumber(finance.spent), "line"),
    financeRow("- Thiếu hôm trước:", formatLedgerNumber(finance.prevShortfall), "line"),
    financeRow("Cộng chi:", formatLedgerNumber(finance.totalSpent), "total"),
    financeRow("So sánh", "", "heading"),
    financeRow("Thừa trong ngày:", formatLedgerNumber(finance.surplus), "line"),
    financeRow("Thiếu trong ngày:", formatLedgerNumber(finance.shortfall), "line"),
  );
  return lines;
}

function dateLine(year, month, day) {
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `Ngày ${dd} tháng ${mm} năm ${year}`;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function emptySheet() {
  return {
    rows: [],
    carryIn: null,
    carryOut: null,
    showTotal: false,
    showSignature: true,
    totals: null,
  };
}

function buildMonthBook({ year, month, unitName, dayViews, cover = {}, signatures = {}, signatureImages = {}, signatureImageLayout = null }) {
  const days = (dayViews || []).map((view) => {
    const notLoaded = view.lines == null;
    const draft = view.status !== "locked";
    const parts = String(view.date || "").split("-").map(Number);
    return {
      date: view.date,
      dateLine: parts.length === 3 ? dateLine(parts[0], parts[1], parts[2]) : "",
      draft,
      blocked: notLoaded,
      note: "",
      sheets: notLoaded ? [emptySheet()] : sheetsFromLines(view.lines, view.totals),
      financeLines: financeLines(view.finance),
    };
  });
  return {
    year,
    month,
    unitName: unitName || "",
    cover: {
      unitName: unitName || "",
      commander: cover.commander || "",
      keeper: cover.keeper || "",
      dateLine: dateLine(year, month, 1),
      draftDays: days.filter((day) => day.draft).map((day) => day.date),
    },
    signatures: {
      quan_ly: signatures.quan_ly || "",
      truc_ban: signatures.truc_ban || "",
      chi_huy: signatures.chi_huy || "",
    },
    signatureImages: signatureImages || {},
    signatureImageLayout,
    layout: LEDGER_PRINT_LAYOUT,
    days,
    // ponytail: đuôi sổ (biên bản tịnh kho + báo cáo công khai I–VII) gắn sau qua `tail`.
    tail: null,
  };
}

function countBookPages(book) {
  const dayPages = (book?.days || []).reduce((sum, day) => sum + (day.sheets?.length || 0) * 2, 0);
  return 1 + dayPages + (book?.tail ? 1 : 0);
}

export {
  buildMonthBook,
  countBookPages,
  dateLine,
  daysInMonth,
  financeLines,
  formatLedgerNumber,
  sheetsFromLines,
};
