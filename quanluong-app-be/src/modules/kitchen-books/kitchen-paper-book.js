/**
 * Tính trang sổ giấy: phiếu nhập, phiếu xuất, sổ theo dõi.
 * Số lượng chỉ từ phiếu. Không có trường thu chi.
 * JS làm mọi phép cộng, tồn, thành tiền, số thứ tự và chữ tiền.
 */

const QTY_SCALE = 10000;

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function toQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * QTY_SCALE);
}

function fromQty(scaled) {
  return scaled / QTY_SCALE;
}

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function readGroup(n) {
  const c = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts = [];
  if (c > 0) parts.push(`${DIGITS[c]} trăm`);
  if (t > 1) parts.push(`${DIGITS[t]} mươi`);
  else if (t === 1) parts.push("mười");
  else if (c > 0 && u > 0) parts.push("lẻ");
  if (u > 0) {
    if (u === 1 && t > 1) parts.push("mốt");
    else if (u === 5 && t > 0) parts.push("lăm");
    else parts.push(DIGITS[u]);
  } else if (c === 0 && t === 0) {
    return DIGITS[0];
  }
  return parts.join(" ");
}

/** Đọc số tiền như dòng chữ trên phiếu mẫu (không dấu phẩy). */
function readMoneyInWords(value) {
  const n = roundMoney(value);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "Không đồng";
  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ", "tỷ tỷ"];
  const chunks = [];
  let rest = n;
  while (rest > 0) {
    chunks.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const parts = [];
  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    if (chunks[i] === 0) continue;
    const words = readGroup(chunks[i]);
    const scale = i < scales.length ? scales[i] : "";
    parts.push(scale ? `${words} ${scale}` : words);
  }
  const sentence = `${parts.join(" ")} đồng`.replace(/\s+/g, " ").trim();
  return sentence.charAt(0).toLocaleUpperCase("vi") + sentence.slice(1);
}

function receiptQtyScaled(line) {
  return toQty(line?.trenMuaTt) + toQty(line?.trenTgcb) + toQty(line?.dvMuaTt) + toQty(line?.dvTgcb);
}

function issueQtyScaled(line) {
  return toQty(line?.sang) + toQty(line?.trua) + toQty(line?.chieu);
}

function receiptQty(line) {
  return fromQty(receiptQtyScaled(line));
}

function issueQty(line) {
  return fromQty(issueQtyScaled(line));
}

function lineAmount(qty, price) {
  if (!qty) return 0;
  return roundMoney(qty * Number(price || 0));
}

function presentLines(lines, qtyOf) {
  let tt = 0;
  const rows = (lines || []).map((line) => {
    const qty = qtyOf(line);
    const amount = lineAmount(qty, line.price);
    const visible = qty !== 0;
    if (visible) tt += 1;
    return { ...line, qty, amount, tt: visible ? tt : 0 };
  });
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return {
    rows,
    itemCount: tt,
    total,
    words: readMoneyInWords(total),
  };
}

function presentReceipt(lines) {
  return presentLines(lines, receiptQty);
}

function presentIssue(lines) {
  return presentLines(lines, issueQty);
}

function addDaysYmd(ymd, days) {
  const [year, month, day] = String(ymd).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${m}-${d}`;
}

function monthOf(ymd) {
  return String(ymd).slice(0, 7);
}

function daysOfMonth(month) {
  const [year, mon] = String(month).split("-").map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const out = [];
  for (let day = 1; day <= last; day += 1) {
    out.push(`${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return out;
}

function slipNoFromDate(ymd) {
  return String(ymd).slice(8, 10);
}

function bookNoFromDate(ymd) {
  return String(ymd).slice(5, 7);
}

function eachDate(start, end) {
  const out = [];
  if (!start || !end || start > end) return out;
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return out;
}

/**
 * Tồn từng ngày. openingById là tồn trước ngày đầu của `dates` (thường là 0).
 * movements: { [ymd]: { in: { [id]: qty }, out: { [id]: qty } } }
 * catalog: { [id]: { name, uom, sort, price } }
 */
function propagateStock({ dates, movements = {}, openingById = {}, catalog = {} }) {
  const stock = new Map();
  for (const [id, qty] of Object.entries(openingById || {})) {
    const scaled = toQty(qty);
    if (scaled !== 0) stock.set(String(id), scaled);
  }
  const days = [];
  for (const date of dates || []) {
    const move = movements[date] || {};
    const ids = new Set([
      ...stock.keys(),
      ...Object.keys(move.in || {}),
      ...Object.keys(move.out || {}),
    ]);
    const lines = [];
    for (const id of ids) {
      const opening = stock.get(id) || 0;
      const inn = toQty(move.in?.[id]);
      const out = toQty(move.out?.[id]);
      const close = opening + inn - out;
      if (opening === 0 && inn === 0 && out === 0 && close === 0) continue;
      const meta = catalog[id] || {};
      const dd = slipNoFromDate(date);
      lines.push({
        commodityId: id,
        name: meta.name || "",
        uom: meta.uom || "",
        sort: meta.sort ?? 0,
        price: meta.price ?? 0,
        opening: fromQty(opening),
        inQty: fromQty(inn),
        outQty: fromQty(out),
        close: fromQty(close),
        slipIn: inn !== 0 ? dd : "",
        slipOut: out !== 0 ? dd : "",
        negative: close < 0,
      });
      if (close === 0) stock.delete(id);
      else stock.set(id, close);
    }
    lines.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "vi"));
    days.push({
      date,
      lines,
      negativeCount: lines.filter((line) => line.negative).length,
      hasData: lines.some((line) => line.inQty !== 0 || line.outQty !== 0 || line.opening !== 0),
    });
  }
  return { days, closing: Object.fromEntries([...stock].map(([id, qty]) => [id, fromQty(qty)])) };
}

/**
 * Với mỗi mặt hàng đang âm trong một ngày, tìm ngày đầu chuỗi âm liên tục
 * và số cần nhập thêm = |tồn âm lớn nhất của chuỗi|.
 */
function negativeStarts(days) {
  const byItem = new Map();
  for (const day of days || []) {
    for (const line of day.lines || []) {
      const id = String(line.commodityId);
      const runs = byItem.get(id) || [];
      const close = toQty(line.close);
      const open = runs.length ? runs[runs.length - 1] : null;
      if (close < 0) {
        if (open && open.open) {
          open.min = Math.min(open.min, close);
          open.dates.push(day.date);
        } else {
          runs.push({
            open: true,
            commodityId: id,
            name: line.name,
            uom: line.uom,
            startDate: day.date,
            min: close,
            dates: [day.date],
          });
        }
      } else if (open) {
        open.open = false;
      }
      byItem.set(id, runs);
    }
  }
  const out = [];
  for (const runs of byItem.values()) {
    for (const run of runs) {
      out.push({
        commodityId: run.commodityId,
        name: run.name,
        uom: run.uom,
        startDate: run.startDate,
        suggestQty: fromQty(Math.abs(run.min)),
        dates: run.dates,
      });
    }
  }
  return out;
}

function negativesOnDate(runs, date) {
  return (runs || [])
    .filter((run) => run.dates.includes(date))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, "vi"));
}

/**
 * Sidebar cân đối — chỉ để hiển thị. Không ghi vào phiếu.
 * Thu lấy từ công khai tài chính đã tính. Chi là thành tiền phiếu xuất lúc đang sửa.
 */
function cktcBalanceView({ finance, issueTotal = 0 }) {
  const fin = finance || {};
  const other = fin.otherIncome || {};
  const mealIncome = roundMoney(fin.subtotal);
  const anThem = roundMoney(other.anThem);
  const truyLinh = roundMoney(other.truyLinh);
  const thuKhach = roundMoney(other.thuKhach);
  const riceSubsidy = roundMoney(fin.riceSubsidy);
  const thu = mealIncome + anThem + truyLinh + thuKhach + riceSubsidy;
  const chi = roundMoney(issueTotal);
  const diff = thu - chi;
  const prevSurplus = roundMoney(fin.prevSurplus);
  const prevShortfall = roundMoney(fin.prevShortfall);
  const carried = prevSurplus - prevShortfall + diff;
  return {
    mealIncome,
    anThem,
    truyLinh,
    thuKhach,
    riceSubsidy,
    thu,
    chi,
    diff,
    carried,
    surplus: carried > 0,
  };
}

function appliedSlipPrice(line) {
  const kind = String(line?.priceKind || "").toLowerCase();
  if (kind === "tgsx" && line?.tgsxPrice != null && line.tgsxPrice !== "") {
    return Number(line.tgsxPrice);
  }
  return Number(line?.unitPrice || 0);
}

function groupReceiptLines(dbLines) {
  const buckets = new Map();
  for (const line of dbLines || []) {
    const qty = toQty(line.quantity);
    if (qty === 0) continue;
    const price = appliedSlipPrice(line);
    const key = `${line.commodityId}:${roundMoney(price)}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        commodityId: line.commodityId,
        code: line.commodity?.code || line.code || "",
        name: line.commodity?.name || line.name || "",
        uom: line.commodity?.measureUnit || line.uom || "",
        price,
        trenMuaTt: 0,
        trenTgcb: 0,
        dvMuaTt: 0,
        dvTgcb: 0,
        lineNote: line.lineNote || "",
      };
      buckets.set(key, bucket);
    }
    const source = line.lineSource === "on_guarantee" ? "tren" : "dv";
    const kind = String(line.priceKind || "").toLowerCase() === "tgsx" ? "Tgcb" : "MuaTt";
    const field = `${source}${kind}`;
    bucket[field] = fromQty(toQty(bucket[field]) + qty);
    if (!bucket.lineNote && line.lineNote) bucket.lineNote = line.lineNote;
  }
  return [...buckets.values()];
}

/** Cấp 2 là depth ≥ 1. Chỉ cấp 1 (depth 0) được gửi cột Trên bảo đảm. */
function isKitchenLevel2(depth) {
  return Number(depth) !== 0;
}

function addQty(map, key, qty) {
  map.set(key, (map.get(key) || 0) + toQty(qty));
}

function guaranteeMapFromRows(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const id = String(row.commodityId ?? "");
    if (!id) continue;
    addQty(map, `${id}:market`, row.trenMuaTt);
    addQty(map, `${id}:tgsx`, row.trenTgcb);
  }
  return map;
}

function guaranteeMapFromStored(lines) {
  const map = new Map();
  for (const line of lines || []) {
    if (line.lineSource !== "on_guarantee") continue;
    const kind = String(line.priceKind || "").toLowerCase() === "tgsx" ? "tgsx" : "market";
    addQty(map, `${line.commodityId}:${kind}`, line.quantity);
  }
  return map;
}

function sameQtyMap(left, right) {
  const keys = new Set([...left.keys(), ...right.keys()]);
  for (const key of keys) {
    if ((left.get(key) || 0) !== (right.get(key) || 0)) return false;
  }
  return true;
}

/**
 * Cấp 2 không được đổi cột Trên bảo đảm. Giá trị gửi lên phải trùng dòng đồng bộ đang lưu.
 * @returns {boolean} true khi phải từ chối cả phiếu
 */
function level2GuaranteeRejected(depth, submittedRows, storedLines) {
  if (!isKitchenLevel2(depth)) return false;
  return !sameQtyMap(guaranteeMapFromRows(submittedRows), guaranteeMapFromStored(storedLines));
}

/** Nhập bù chỉ cộng vào Đơn vị bảo đảm — Mua TT. */
function applyReceiptTopUp(row, amount) {
  return {
    ...row,
    dvMuaTt: fromQty(toQty(row?.dvMuaTt) + toQty(amount)),
  };
}

/** Khai báo tồn đầu chỉ khi chưa có phiếu nhập hoặc phiếu xuất nào. */
function canDeclareOpeningStock(slipCount) {
  return Number(slipCount) === 0;
}

function expandReceiptRow(row) {
  const price = Number(row.price || 0);
  const specs = [
    ["trenMuaTt", "on_guarantee", "market"],
    ["trenTgcb", "on_guarantee", "tgsx"],
    ["dvMuaTt", "unit_self", "market"],
    ["dvTgcb", "unit_self", "tgsx"],
  ];
  const out = [];
  for (const [field, lineSource, priceKind] of specs) {
    const qty = fromQty(toQty(row[field]));
    if (!qty) continue;
    out.push({
      commodityId: Number(row.commodityId),
      quantity: qty,
      unitPrice: price,
      tgsxPrice: priceKind === "tgsx" ? price : null,
      priceKind,
      lineSource,
      lineNote: row.lineNote || null,
      amount: lineAmount(qty, price),
    });
  }
  return out;
}

function groupIssueLines(dbLines) {
  const buckets = new Map();
  for (const line of dbLines || []) {
    const key = String(line.commodityId);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        commodityId: line.commodityId,
        code: line.commodity?.code || "",
        name: line.commodity?.name || line.name || "",
        uom: line.commodity?.measureUnit || line.uom || "",
        price: Number(line.unitPrice || 0),
        sang: 0,
        trua: 0,
        chieu: 0,
        lineNote: line.lineNote || "",
      };
      buckets.set(key, bucket);
    }
    bucket.sang = fromQty(toQty(bucket.sang) + toQty(line.sang));
    bucket.trua = fromQty(toQty(bucket.trua) + toQty(line.trua));
    bucket.chieu = fromQty(toQty(bucket.chieu) + toQty(line.chieu));
  }
  return [...buckets.values()];
}

function columnPercents(widths) {
  const total = widths.reduce((sum, width) => sum + width, 0);
  return widths.map((width) => `${(width / total) * 100}%`);
}

const RECEIPT_COL_WIDTHS = [3.6, 4.2, 20, 5, 6.7, 6.4, 6.2, 6.2, 10, 8.9, 10, 9.2];
const ISSUE_COL_WIDTHS = [3.6, 4.2, 22, 5, 6.2, 6.2, 6.2, 7, 8.5, 10, 8];
const STOCK_COL_WIDTHS = [7.9, 7.9, 23.2, 6.7, 12.7, 8.9, 8.4, 8.9, 6.4];

function escHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function formatQtyCell(value) {
  const scaled = toQty(value);
  if (scaled === 0) return "";
  return String(fromQty(scaled));
}

function formatMoneyCell(value) {
  const n = roundMoney(value);
  if (!n) return "";
  return n.toLocaleString("vi-VN");
}

export {
  RECEIPT_COL_WIDTHS,
  ISSUE_COL_WIDTHS,
  STOCK_COL_WIDTHS,
  addDaysYmd,
  appliedSlipPrice,
  bookNoFromDate,
  cktcBalanceView,
  columnPercents,
  daysOfMonth,
  eachDate,
  escHtml,
  applyReceiptTopUp,
  canDeclareOpeningStock,
  expandReceiptRow,
  isKitchenLevel2,
  level2GuaranteeRejected,
  formatMoneyCell,
  formatQtyCell,
  fromQty,
  groupIssueLines,
  groupReceiptLines,
  issueQty,
  lineAmount,
  monthOf,
  negativeStarts,
  negativesOnDate,
  presentIssue,
  presentReceipt,
  propagateStock,
  readMoneyInWords,
  receiptQty,
  roundMoney,
  slipNoFromDate,
  toQty,
};
