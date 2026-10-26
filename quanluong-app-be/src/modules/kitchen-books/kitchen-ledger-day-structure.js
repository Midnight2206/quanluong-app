import { dateLine, financeLines } from "./kitchen-ledger-month-book.js";

const MEALS = [
  { key: "sang", label: "Sáng" },
  { key: "trua", label: "Trưa" },
  { key: "chieu", label: "Chiều" },
];

const EXTRAS = [
  { key: "benhXa", label: "Bệnh xá" },
  { key: "benhNhan", label: "Bệnh nhân" },
  { key: "omTrai", label: "Ốm tại trại" },
  { key: "leTet", label: "Lễ, tết" },
];

/** Cột khung một ngày. UI chỉ vẽ danh sách này, không tự thêm cột. */
const DAY_COLUMNS = [
  { key: "tt", label: "TT", role: "identity" },
  { key: "name", label: "Tên LTTP", role: "identity" },
  { key: "uom", label: "ĐVT", role: "identity" },
  { key: "unitPrice", label: "Đơn giá", role: "price" },
  { key: "openingQty", label: "Số lượng", role: "carry" },
  { key: "openingAmount", label: "Thành tiền", role: "carry" },
  { key: "inG", label: "Mua TT", role: "slip" },
  { key: "inH", label: "TG CB", role: "slip" },
  { key: "inI", label: "Mua TT", role: "manual" },
  { key: "inJ", label: "TG CB", role: "manual" },
  { key: "inAmount", label: "Thành tiền", role: "computed" },
  { key: "totalInQty", label: "Số lượng", role: "computed" },
  { key: "totalInAmount", label: "Thành tiền", role: "computed" },
  { key: "mealQty", label: "Số lượng", role: "computed" },
  { key: "mealAmount", label: "Thành tiền", role: "computed" },
  { key: "otherQty", label: "Số lượng", role: "manual" },
  { key: "otherAmount", label: "Thành tiền", role: "computed" },
  { key: "totalOutQty", label: "Số lượng", role: "computed" },
  { key: "totalOutAmount", label: "Thành tiền", role: "computed" },
  { key: "cktc", label: "Công khai tài chính", role: "finance" },
];

function dateLineOf(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  return dateLine(year, month, day);
}

function rowsOf(kind, movements) {
  return (movements || []).filter((row) => row.kind === kind);
}

function buildDayStructure(view = {}) {
  const headcount = view.headcount || { levels: [], extras: {} };
  const blocked = Boolean(view.ledgerBlocked);
  return {
    date: view.date || "",
    status: view.status || "draft",
    locked: view.status === "locked",
    ledgerBlocked: blocked,
    note: blocked
      ? (view.blockers?.[0]?.message || "Chưa đủ phiếu hoặc bảng giá")
      : "",
    columns: DAY_COLUMNS,
    dateLine: dateLineOf(view.date),
    financeLines: financeLines(view.finance),
    rows: (view.lines || []).map((line, index) => ({ ...line, tt: index + 1 })),
    totals: view.totals || null,
    finance: view.finance || null,
    plan: view.plan || null,
    headcount: {
      meals: MEALS,
      extras: EXTRAS,
      levels: headcount.levels || [],
      values: headcount.extras || {},
    },
    manual: {
      selfSupply: rowsOf("self_supply", view.movements),
      rice: rowsOf("rice", view.movements),
      otherOut: rowsOf("other_out", view.movements),
      opening: rowsOf("opening", view.movements),
    },
  };
}

export { DAY_COLUMNS, EXTRAS, MEALS, buildDayStructure };
