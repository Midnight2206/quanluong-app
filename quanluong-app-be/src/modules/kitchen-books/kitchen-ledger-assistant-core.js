import { normalizeName } from "./kitchen-ledger-settings.js";
import { resolveDate } from "./kitchen-ledger-ai-headcount.js";

const LOW = 0.8;

function fold(value) {
  return String(value ?? "")
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function routeIntent(text, hasImage = false) {
  const raw = String(text ?? "");
  const n = fold(raw);
  if (/quy tac|tu nay/.test(n)) return "rule";
  if (hasImage) return "headcount";
  const nums = raw.match(/\d+/g) || [];
  if (/\d{1,2}\s*[/.]\s*\d{1,2}/.test(raw) && nums.length >= 5) return "headcount";
  if (/(tai sao|vi sao|bao nhieu|bat thuong|thua|thieu|ton kho|con bao nhieu|\bton\b|da nhap|da xuat)/.test(n)) {
    return "question";
  }
  if (/nhu\s*\d{1,2}\s*[/.]\s*\d{1,2}/.test(n) && nums.length < 5) return "headcount";
  if (/(mua|kg|hop|lit|xuat them)/.test(n)) return "movement";
  if (/lich lam viec|lich truc|lich bep/.test(n)) return "movement";
  return "question";
}

function headcountLike(text, anchorDate) {
  const raw = String(text ?? "");
  const refMatch = raw.match(/(?:như|nhu)\s*(\d{1,2})\s*[/.]\s*(\d{1,2})/i);
  if (!refMatch) return null;
  const ref = resolveDate(`${refMatch[1]}/${refMatch[2]}`, anchorDate);
  if (!ref) return null;
  let target = anchorDate;
  for (const match of raw.matchAll(/(\d{1,2})\s*[/.]\s*(\d{1,2})/g)) {
    const date = resolveDate(`${match[1]}/${match[2]}`, anchorDate);
    if (date && date !== ref) target = date;
  }
  return { ref, target };
}

function questionDate(text, anchorDate) {
  const named = String(text).match(/(?:ngày|ngay)\s+(\d{1,2})(?:\s*[/.]\s*(\d{1,2})(?:\s*[/.]\s*(\d{2,4}))?)?/i);
  const slash = named ? null : String(text).match(/(\d{1,2})\s*[/.]\s*(\d{1,2})(?!\d)/);
  const day = named?.[1] || slash?.[1];
  if (!day) return anchorDate;
  const month = named?.[2] || slash?.[2] || String(anchorDate).slice(5, 7);
  const year = named?.[3] || String(anchorDate).slice(0, 4);
  return resolveDate(`${day}/${month}/${year}`, anchorDate) || anchorDate;
}

function numberIn(text) {
  const match = fold(text).match(/nguong[^0-9]{0,40}(\d{1,3}(?:\.\d{3})+|\d+)\s*(k)?/);
  if (!match) return null;
  const n = Number(match[1].replace(/\./g, ""));
  if (!Number.isFinite(n)) return null;
  return match[2] ? n * 1000 : n;
}

function proposeSettings(text) {
  const n = fold(text);
  const proposals = [];
  const threshold = numberIn(text);
  if (threshold != null && /nguong|thua|thieu/.test(n)) {
    proposals.push({
      field: "balanceWarnThreshold",
      value: threshold,
      label: `Ngưỡng thừa/thiếu ${threshold} đồng`,
    });
  }
  if (/xuat an|sigma o/.test(n)) {
    proposals.push({ field: "spentBasis", value: "meal_out", label: "Tiền đã sử dụng = xuất ăn (ΣO)" });
  } else if (/cong xuat|sigma s/.test(n)) {
    proposals.push({ field: "spentBasis", value: "total_out", label: "Tiền đã sử dụng = cộng xuất (ΣS)" });
  }
  if (/le tet/.test(n) && /trua/.test(n)) {
    proposals.push({ field: "holidayLunchOnly", value: true, label: "Lễ tết chỉ tính bữa trưa" });
  } else if (/le tet/.test(n) && /ca ngay/.test(n)) {
    proposals.push({ field: "holidayLunchOnly", value: false, label: "Lễ tết tính cả ngày" });
  }
  if (/sua/.test(n) && /ngay bay|mua/.test(n)) {
    proposals.push({ field: "milk.mode", value: "purchase", label: "Sữa: mua theo ngày" });
  } else if (/sua/.test(n) && /benh nhan/.test(n)) {
    proposals.push({ field: "milk.mode", value: "patient_plus_levels", label: "Sữa: bệnh nhân + mức cấu hình" });
  }
  return proposals;
}

function settingsPatch(proposals) {
  const patch = {};
  for (const row of proposals) {
    if (row.field === "milk.mode") patch.milk = { mode: row.value };
    else patch[row.field] = row.value;
  }
  return patch;
}

function formatVi(value) {
  const raw = String(value ?? "0");
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return raw;
  const neg = raw.startsWith("-");
  const [intPart, frac = ""] = (neg ? raw.slice(1) : raw).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const tail = frac.replace(/0+$/, "");
  return `${neg ? "-" : ""}${tail ? `${grouped},${tail}` : grouped}`;
}

function briefAnomalies(view) {
  if (!view) return [];
  const items = [];
  for (const row of view.blockers || []) items.push({ code: row.code, message: row.message });
  for (const row of view.warnings || []) {
    if (!items.some((item) => item.message === row.message)) items.push({ code: row.code, message: row.message });
  }
  const finance = view.finance;
  if (finance?.balanceWarn) {
    items.push({
      code: "balance_threshold",
      message: `Thừa ${formatVi(finance.surplus)} đồng, thiếu ${formatVi(finance.shortfall)} đồng, ngưỡng ${formatVi(finance.balanceWarnThreshold)}.`,
    });
  }
  // ponytail: so với đúng hôm trước, lệch >30% khi cả hai bữa ≥10. Muốn chuẩn hơn thì lấy trung vị nhiều ngày.
  const prev = view.previousHeadcount?.levels || [];
  for (const level of view.headcount?.levels || []) {
    const before = prev.find((row) => Number(row.dailyAmount) === Number(level.dailyAmount));
    if (!before) continue;
    for (const meal of ["sang", "trua", "chieu"]) {
      const now = Number(level[meal]) || 0;
      const old = Number(before[meal]) || 0;
      if (old < 10 || now < 10) continue;
      const ratio = now / old;
      if (ratio > 1.3 || ratio < 0.7) {
        items.push({
          code: "headcount_shift",
          message: `Mức ${formatVi(level.dailyAmount)} bữa ${meal}: ${old} hôm trước, ${now} hôm nay.`,
        });
      }
    }
  }
  return items;
}

function lineQty(line, key) {
  const n = Number(line?.[key]);
  return Number.isFinite(n) ? n : 0;
}

function renderTool(tool, view, itemName) {
  const date = view?.date || "";
  if (!view || view.ledgerBlocked) {
    const block = (view?.blockers || []).map((row) => row.message).join(" ");
    return block || "Sổ ngày này chưa lập được. Số chưa có để trả lời.";
  }
  if (tool === "anomalies") {
    const items = briefAnomalies(view);
    return items.length ? items.map((row) => row.message).join(" ") : "Không thấy bất thường trên sổ ngày này.";
  }
  if (tool === "explain_finance") {
    const finance = view.finance;
    if (!finance) return "Chưa có khối thu chi.";
    return [
      `Ngày ${date}, số trên sổ đã tính:`,
      `cộng thu ${formatVi(finance.totalIncome)}`,
      `tiền đã sử dụng ${formatVi(finance.spent)} (${finance.spentBasis === "meal_out" ? "xuất ăn" : "cộng xuất"})`,
      `thừa hôm trước ${formatVi(finance.prevSurplus)}`,
      `thiếu hôm trước ${formatVi(finance.prevShortfall)}`,
      `thừa trong ngày ${formatVi(finance.surplus)}`,
      `thiếu trong ngày ${formatVi(finance.shortfall)}.`,
    ].join(" ");
  }
  if (tool === "receipts" || tool === "issues") {
    const rows = (view.lines || []).filter((line) => (
      tool === "receipts"
        ? ["inG", "inH", "inI", "inJ"].some((key) => lineQty(line, key) !== 0)
        : lineQty(line, "mealQty") !== 0 || lineQty(line, "otherQty") !== 0
    ));
    if (!rows.length) return tool === "receipts" ? `Ngày ${date} chưa có dòng nhập.` : `Ngày ${date} chưa có dòng xuất.`;
    return rows.map((line) => (
      tool === "receipts"
        ? `${line.name}: BĐ mua ${formatVi(line.inG)}, BĐ TG ${formatVi(line.inH)}, ĐV mua ${formatVi(line.inI)}, ĐV TG ${formatVi(line.inJ)}`
        : `${line.name}: xuất ăn ${formatVi(line.mealQty)} ${line.uom || ""}, xuất khác ${formatVi(line.otherQty)}`.trim()
    )).join("; ");
  }
  const key = normalizeName(itemName);
  const hits = (view.lines || []).filter((line) => key && normalizeName(line.name).includes(key));
  if (!hits.length) return `Không thấy «${itemName || "mặt hàng"}» trên sổ ngày ${date}.`;
  const lots = (view.closingLots || []).filter((lot) => key && normalizeName(lot.name || lot.itemName).includes(key));
  const lotText = lots.length
    ? ` Lô FIFO còn: ${lots.map((lot) => `${formatVi(lot.qty)} giá ${formatVi(lot.unitPrice)} nhận ${lot.receivedDate || ""}`.trim()).join("; ")}.`
    : "";
  return `${hits.map((line) => (
    `${line.name}: tồn đầu ${formatVi(line.openingQty)}, nhập ${formatVi(line.inG)}/${formatVi(line.inH)}/${formatVi(line.inI)}/${formatVi(line.inJ)} (BĐ mua, BĐ TG, ĐV mua, ĐV TG), xuất ăn ${formatVi(line.mealQty)}, xuất khác ${formatVi(line.otherQty)}, còn ${formatVi(line.closingQty)} ${line.uom || ""}. Giá ${formatVi(line.unitPrice)}.`
  )).join(" ")}${lotText}`;
}

function routeQuestion(text, lineNames = []) {
  const n = fold(text);
  if (/thua|thieu|thu |chi |tai sao|vi sao|vi sao/.test(n) || /tại sao|vì sao|thừa|thiếu/.test(String(text))) {
    return { tool: "explain_finance" };
  }
  if (/bat thuong|am kho|canh bao/.test(n)) return { tool: "anomalies" };
  if (/xuat/.test(n) && !/nhap/.test(n)) return { tool: "issues" };
  if (/nhap|da nhan|ve kho/.test(n)) return { tool: "receipts" };
  if (/ton|con bao nhieu|trong kho/.test(n)) {
    const hit = (lineNames || []).find((name) => n.includes(fold(name)));
    return { tool: "item_stock", itemName: hit || "" };
  }
  return null;
}

export {
  LOW,
  briefAnomalies,
  fold,
  headcountLike,
  proposeSettings,
  questionDate,
  renderTool,
  routeIntent,
  routeQuestion,
  settingsPatch,
};
