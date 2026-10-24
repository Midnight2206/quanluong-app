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
  { key: "openingQty", label: "Tồn SL", role: "carry" },
  { key: "openingAmount", label: "Tồn tiền", role: "carry" },
  { key: "inG", label: "BĐ mua", role: "slip" },
  { key: "inH", label: "BĐ TG", role: "slip" },
  { key: "inI", label: "ĐV mua", role: "manual" },
  { key: "inJ", label: "ĐV TG", role: "manual" },
  { key: "inAmount", label: "Tiền nhập", role: "computed" },
  { key: "totalInQty", label: "Cộng SL", role: "computed" },
  { key: "totalInAmount", label: "Cộng tiền", role: "computed" },
  { key: "mealQty", label: "Ăn SL", role: "computed" },
  { key: "mealAmount", label: "Ăn tiền", role: "computed" },
  { key: "otherQty", label: "Khác SL", role: "manual" },
  { key: "otherAmount", label: "Khác tiền", role: "computed" },
  { key: "totalOutQty", label: "Xuất SL", role: "computed" },
  { key: "totalOutAmount", label: "Xuất tiền", role: "computed" },
  { key: "closingQty", label: "Còn SL", role: "computed" },
  { key: "closingAmount", label: "Còn tiền", role: "computed" },
];

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
