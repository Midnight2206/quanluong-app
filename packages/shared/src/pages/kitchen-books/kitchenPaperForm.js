import { addDaysYmd, daysOfMonth, issueQty, receiptQty } from "./kitchenPaperBook.js";

function num(value) {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function qtyText(value) {
  const n = num(value);
  return n === 0 ? "" : String(n);
}

function rowKey() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function blankReceiptRow() {
  return {
    key: rowKey(),
    commodityId: "",
    code: "",
    name: "",
    uom: "",
    trenMuaTt: "",
    trenTgcb: "",
    dvMuaTt: "",
    dvTgcb: "",
    price: "",
    lineNote: "",
  };
}

function blankIssueRow() {
  return {
    key: rowKey(),
    commodityId: "",
    code: "",
    name: "",
    uom: "",
    sang: "",
    trua: "",
    chieu: "",
    price: "",
    lineNote: "",
  };
}

function receiptFromApi(line) {
  return {
    key: rowKey(),
    commodityId: line.commodityId,
    code: line.code || "",
    name: line.name || "",
    uom: line.uom || "",
    trenMuaTt: qtyText(line.trenMuaTt),
    trenTgcb: qtyText(line.trenTgcb),
    dvMuaTt: qtyText(line.dvMuaTt),
    dvTgcb: qtyText(line.dvTgcb),
    price: qtyText(line.price),
    lineNote: line.lineNote || "",
  };
}

function issueFromApi(line) {
  return {
    key: rowKey(),
    commodityId: line.commodityId,
    code: line.code || "",
    name: line.name || "",
    uom: line.uom || "",
    sang: qtyText(line.sang),
    trua: qtyText(line.trua),
    chieu: qtyText(line.chieu),
    price: qtyText(line.price),
    lineNote: line.lineNote || "",
  };
}

function receiptCalc(row) {
  return {
    ...row,
    trenMuaTt: num(row.trenMuaTt),
    trenTgcb: num(row.trenTgcb),
    dvMuaTt: num(row.dvMuaTt),
    dvTgcb: num(row.dvTgcb),
    price: num(row.price),
  };
}

function issueCalc(row) {
  return {
    ...row,
    sang: num(row.sang),
    trua: num(row.trua),
    chieu: num(row.chieu),
    price: num(row.price),
  };
}

function withBlank(rows, blank) {
  if (!rows.length || rows[rows.length - 1].commodityId) return [...rows, blank()];
  return rows;
}

function calendarCells(month) {
  const days = daysOfMonth(month);
  const first = new Date(`${days[0]}T00:00:00Z`).getUTCDay();
  const lead = (first + 6) % 7;
  return [...Array(lead).fill(null), ...days];
}

function focusPaperCell(event, rowCount) {
  const cell = event.currentTarget.closest("[data-cell]");
  if (!cell) return;
  const [row, col] = cell.dataset.cell.split("-").map(Number);
  const cols = Number(cell.dataset.cols || 1);
  let nextRow = row;
  let nextCol = col;
  if (event.key === "Enter") nextCol += 1;
  else if (event.key === "ArrowDown") nextRow += 1;
  else if (event.key === "ArrowUp") nextRow -= 1;
  else return;
  event.preventDefault();
  if (nextCol >= cols) {
    nextCol = 0;
    nextRow += 1;
  }
  if (nextCol < 0) nextCol = 0;
  if (nextRow < 0 || nextRow >= rowCount) return;
  const target = cell.closest("table")?.querySelector(`[data-cell="${nextRow}-${nextCol}"] input, [data-cell="${nextRow}-${nextCol}"]`);
  const input = target?.matches?.("input") ? target : target?.querySelector?.("input");
  input?.focus();
}

export {
  addDaysYmd,
  blankIssueRow,
  blankReceiptRow,
  calendarCells,
  focusPaperCell,
  issueCalc,
  issueFromApi,
  issueQty,
  num,
  qtyText,
  receiptCalc,
  receiptFromApi,
  receiptQty,
  withBlank,
};
