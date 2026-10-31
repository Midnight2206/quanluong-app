import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  QUESTION_TOPIC,
  ledgerRecordBatchSchema,
} from "./ledgerRecords.js";
import { normalizeAiHeadcount, resolveDate } from "./kitchen-ledger-ai-headcount.js";
import { mergeLedgerSettings, normalizeName } from "./kitchen-ledger-settings.js";

const DEFAULT_EXTRACT_MODEL = "google/gemini-3.5-flash";
const DEFAULT_QUESTION_MODEL = "google/gemini-3.8-flash";

function ledgerAiModels() {
  const extract = String(process.env.LEDGER_AI_EXTRACT_MODEL || "").trim() || DEFAULT_EXTRACT_MODEL;
  const question = String(process.env.LEDGER_AI_QUESTION_MODEL || "").trim() || DEFAULT_QUESTION_MODEL;
  return { extract, question };
}

function recordsPrompt({ settings, anchorDate, commodities = [], facts = [], questionOnly = false } = {}) {
  const open = anchorDate || "";
  if (questionOnly) {
    return [
      "Chi tra ve ban ghi hoi. Khong tra so tien, khong dien so, khong ke ten nguoi.",
      "topic: finance (thua thieu), anomaly (bat thuong), stock (ton mot mat hang), receipts (da nhap), issues (da xuat).",
      "Moi ban ghi co confidence tu 0 den 1 va source la doan trich ngan tu cau hoi.",
      `Ngay dang mo ${open}.`,
      '{"records":[{"type":"question","date":"YYYY-MM-DD","topic":"finance","itemName":"","confidence":0.9,"source":"doan trich"}]}',
    ].join(" ");
  }
  const levels = mergeLedgerSettings(settings).levels.map((level) => Number(level.dailyAmount)).join(", ");
  const names = commodities.slice(0, 120).map((row) => `${row.name} (${row.measureUnit})`).join(", ");
  return [
    "Doi cau hoac anh thanh mang ban ghi. Khong chon vi tri tren so, khong tinh tien, khong ke ten nguoi.",
    "type headcount: quan so sang, trua, chieu theo tung muc an. An them: benhXa, benhNhan, omTrai, leTet.",
    `Cac muc, dung thu tu: ${levels}. Mau 18/10: 91 97 97 · 0 0 0 la muc dau roi muc sau.`,
    "type outside_purchase: mua ngoai vao don vi bao dam. type stock_in: nhap kho, origin unit_purchase hoac unit_tgsx. type meal_out: so luong xuat an. type stock_out: xuat khac.",
    "Hang da co tren phieu xuat thi khong tao ban ghi vao cot Tren BD. Gao nhap tay can column G, H, I hoac J.",
    "Moi hang can sourceKind market hoac tgsx va grade. Khong doan pham cap.",
    "type setting chi khi cau doi quy tac: field balanceWarnThreshold, spentBasis (meal_out hoac total_out), holidayLunchOnly.",
    "type schedule: lich lam viec trong ngay, chi la chu, khong doi so tren so.",
    "type note: ghi chu, khong phai so lieu.",
    "Moi ban ghi co confidence 0 den 1 va source la doan trich ngan. Don gia la dong, 180k = 180000.",
    `Nam neo ${open.slice(0, 4)}. Ngay dang mo ${open}.`,
    names ? `Danh muc: ${names}.` : "",
    facts.length ? `Ghi nho: ${facts.join(" | ")}` : "",
    '{"records":[{"type":"headcount","date":"YYYY-MM-DD","levels":[{"dailyAmount":72000,"sang":0,"trua":0,"chieu":0}],"extras":{"benhXa":0,"benhNhan":0,"omTrai":0,"leTet":0},"confidence":0.9,"source":"doan trich"}]}',
  ].filter(Boolean).join(" ");
}

function reject(message) {
  return new AppError({
    message: message || "AI trả về bản ghi không đúng mẫu. Nhập tay ở bảng phía trên.",
    statusCode: 502,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
  });
}

function matchCommodity(name, commodities) {
  const key = normalizeName(name);
  if (!key) return [];
  return (commodities || []).filter((row) => {
    const item = normalizeName(row.name);
    return item === key || item.startsWith(key) || key.startsWith(item);
  });
}

function isRice(name, pattern) {
  return normalizeName(name).includes(normalizeName(pattern || "gạo"));
}

/**
 * Đặt một bản ghi hàng vào khung ngày. Cột do máy chủ chọn.
 * Gạo nhập tay → Trên BĐ mua. Mua ngoài và nhập đơn vị mua → cột I.
 * Tự sản xuất đơn vị → cột J. Xuất khác → xuất khác, không phải xuất ăn.
 */
function placeLine(record, { commodities, ricePattern }) {
  const hits = matchCommodity(record.name, commodities);
  const commodity = hits.length === 1 ? hits[0] : null;
  const rice = isRice(record.name, ricePattern);
  let kind = "self_supply";
  let source = "I";
  let place = "Đơn vị BĐ mua TT";
  let savable = true;
  let warning = "";
  if (record.type === "stock_out") {
    kind = "other_out";
    source = "P";
    place = "Xuất khác";
  } else if (record.type === "meal_out") {
    kind = "meal_out";
    source = "N";
    place = "Xuất ăn";
  } else if (rice) {
    kind = "rice";
    if (!["G", "H", "I", "J"].includes(record.column)) {
      savable = false;
      warning = "Chọn cột G/H/I/J cho gạo.";
      source = "";
    } else {
      source = record.column;
    }
    place = "Gạo nhập tay – tạm thời";
  } else if (record.column === "G" || record.column === "H") {
    savable = false;
    warning = "Cột Trên BĐ chỉ lấy từ phiếu xuất. Hàng này ghi vào đơn vị bảo đảm.";
  } else if (record.type === "stock_in" && record.origin === "unit_tgsx") {
    source = "J";
    place = "Đơn vị BĐ TGSX";
  }
  if (!rice && (kind === "self_supply" || kind === "meal_out") && !commodity) {
    savable = false;
    warning = warning || (hits.length > 1
      ? "Nhiều mặt hàng trùng tên. Chọn ở bảng nhập."
      : "Chưa khớp danh mục. Nhập ở bảng.");
  }
  if (kind === "rice" && !commodity && record.unitPrice == null) {
    savable = false;
    warning = warning || "Gạo chưa có trong danh mục thì cần đơn giá.";
  }
  const sourceKind = record.sourceKind || commodity?.sourceKind || "";
  const grade = record.grade || commodity?.grade || "";
  if (!sourceKind || !grade) {
    savable = false;
    warning = warning || "Chưa có nguồn Mua TT/TGSX hoặc phẩm cấp.";
  }
  return {
    name: commodity?.name || record.name,
    commodityId: commodity?.id ?? null,
    measureUnit: commodity?.measureUnit || record.uom || "",
    qty: record.qty,
    unitPrice: record.unitPrice ?? null,
    kind,
    source,
    sourceKind: sourceKind || null,
    grade: grade || null,
    place,
    issuePolicy: "today",
    confidence: record.confidence,
    sourceSnippet: record.source,
    savable,
    warning,
    priceNote: record.unitPrice != null ? "Nếu đã có bảng giá, sổ lấy giá bảng." : "",
  };
}

function placeSetting(record) {
  const { field, value } = record;
  if (field === "balanceWarnThreshold") {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw reject("Ngưỡng thừa/thiếu không phải số.");
    return { field, value: n, label: `Ngưỡng thừa/thiếu ${n} đồng`, confidence: record.confidence, source: record.source };
  }
  if (field === "spentBasis") {
    if (value !== "meal_out" && value !== "total_out") throw reject("Tiền đã sử dụng chỉ nhận xuất ăn hoặc cộng xuất.");
    return {
      field,
      value,
      label: value === "meal_out" ? "Tiền đã sử dụng = xuất ăn (ΣO)" : "Tiền đã sử dụng = cộng xuất (ΣS)",
      confidence: record.confidence,
      source: record.source,
    };
  }
  if (field === "holidayLunchOnly") {
    const on = value === true || value === "true";
    const off = value === false || value === "false";
    if (!on && !off) throw reject("Lễ tết chỉ trưa cần đúng hoặc sai.");
    return {
      field,
      value: on,
      label: on ? "Lễ tết chỉ tính bữa trưa" : "Lễ tết tính cả ngày",
      confidence: record.confidence,
      source: record.source,
    };
  }
  throw reject("Cấu hình này không còn trong sổ.");
}

function mapLedgerRecords(raw, { settings, anchorDate, commodities = [], ricePattern } = {}) {
  const parsed = ledgerRecordBatchSchema.safeParse(raw);
  if (!parsed.success) throw reject();
  const pattern = ricePattern || settings?.riceNamePattern || "gạo";
  const lines = [];
  const proposals = [];
  const questions = [];
  const notes = [];
  const schedules = [];
  const headcountInputs = [];
  const sourceByDate = new Map();
  for (const record of parsed.data.records) {
    if (record.type === "headcount") {
      const date = resolveDate(record.date, anchorDate);
      if (date) sourceByDate.set(date, record.source);
      headcountInputs.push({
        date: record.date,
        levels: record.levels.map((level) => ({ ...level, confidence: record.confidence })),
        extras: record.extras ? { ...record.extras, confidence: record.confidence } : null,
      });
    } else if (record.type === "outside_purchase" || record.type === "stock_in" || record.type === "stock_out" || record.type === "meal_out") {
      lines.push({
        ...placeLine(record, { commodities, ricePattern: pattern }),
        date: resolveDate(record.date, anchorDate) || anchorDate || "",
      });
    } else if (record.type === "setting") {
      proposals.push(placeSetting(record));
    } else if (record.type === "question") {
      questions.push({
        tool: QUESTION_TOPIC[record.topic],
        itemName: record.itemName || "",
        date: record.date || anchorDate,
        confidence: record.confidence,
        source: record.source,
      });
    } else if (record.type === "schedule") {
      schedules.push({
        date: resolveDate(record.date, anchorDate) || anchorDate || "",
        text: record.text,
        confidence: record.confidence,
        source: record.source,
      });
    } else {
      notes.push({ text: record.text, confidence: record.confidence, source: record.source });
    }
  }
  const headcount = headcountInputs.length
    ? normalizeAiHeadcount({ days: headcountInputs }, { settings, anchorDate })
    : { days: [], warnings: [] };
  return {
    headcountDays: headcount.days.map((day) => ({
      ...day,
      source: sourceByDate.get(day.date) || "",
    })),
    headcountWarnings: headcount.warnings,
    lines,
    proposals,
    questions,
    notes,
    schedules,
  };
}

export { ledgerAiModels, mapLedgerRecords, placeLine, recordsPrompt };
