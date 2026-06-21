import { CHUNG_TU_EXPORT_KIND } from "./chungTuCategoryConfig";

export function excelColumnLetter(colIndex) {
  let n = Number(colIndex) || 0;
  let col = "";
  while (n >= 0) {
    col = String.fromCharCode((n % 26) + 65) + col;
    n = Math.floor(n / 26) - 1;
  }
  return col;
}

export function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sameNumberArray(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Number(a[i]) !== Number(b[i])) return false;
  }
  return true;
}

export function formatPeriodMonth(periodMonth) {
  const value = String(periodMonth ?? "").trim();
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return value || "—";
  return `${m[2]}/${m[1]}`;
}

export function formatPeriodLabel(doc, exportKind) {
  if (exportKind === CHUNG_TU_EXPORT_KIND.MONTHLY) {
    return formatPeriodMonth(doc.periodMonth ?? doc.periodDate?.slice(0, 7));
  }
  const date = doc.periodDate?.slice(0, 10);
  if (exportKind === CHUNG_TU_EXPORT_KIND.BY_SLIP && doc.issueSlipId) {
    return date ? `${date} · PX #${doc.issueSlipId}` : `PX #${doc.issueSlipId}`;
  }
  return date || "—";
}

export function mergeColumnMappingsWithSuggestedSlots(savedMappings, suggestedColumnSlots) {
  const savedByCol = new Map();
  for (const item of savedMappings ?? []) {
    const col = Number(item?.col);
    if (!Number.isFinite(col)) continue;
    savedByCol.set(col, item);
  }
  if (!Array.isArray(suggestedColumnSlots) || !suggestedColumnSlots.length) {
    return (savedMappings ?? []).map((item) => ({
      col: Number(item.col),
      label: String(item.label ?? "").trim(),
      fieldKey: String(item.fieldKey ?? "").trim(),
    }));
  }
  return suggestedColumnSlots.map((slot) => {
    const saved = savedByCol.get(Number(slot.col));
    const fieldKey = String(saved?.fieldKey ?? slot.defaultFieldKey ?? "").trim();
    return {
      col: Number(slot.col),
      label: String(slot.label ?? saved?.label ?? "").trim(),
      fieldKey,
    };
  });
}

export function chungTuStatusBadge(status) {
  if (status === "synced") {
    return {
      label: "Đã đồng bộ",
      className:
        "rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300",
    };
  }
  if (status === "stale") {
    return {
      label: "Cần đồng bộ lại",
      className:
        "rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200",
    };
  }
  if (status === "locked") {
    return {
      label: "Đã khóa",
      className:
        "rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
    };
  }
  return {
    label: "Chưa đồng bộ",
    className: "rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
  };
}
