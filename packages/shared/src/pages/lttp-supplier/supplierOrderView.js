function formatQty(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const t = x.toFixed(4).replace(/\.?0+$/, "");
  return t === "" ? "0" : t;
}

export function initialSupplierId(links) {
  return Array.isArray(links) && links.length === 1 ? links[0]?.supplierId ?? null : null;
}

export function pairLabel(link) {
  return `${link?.level1UnitName ?? ""} — ${link?.supplierName ?? ""}`;
}

/**
 * Keep a saved recipient selection when those units still exist.
 * No saved list selects every unit. A saved list that matches nothing selects every unit.
 * An explicit empty list stays empty.
 * @param {string[]} availableKeys
 * @param {string[] | null | undefined} savedKeys
 */
export function nextRecipientSelection(availableKeys, savedKeys) {
  const available = (availableKeys ?? []).map((key) => String(key));
  if (!Array.isArray(savedKeys)) return available;
  if (available.length === 0) return savedKeys.map((key) => String(key));
  const allowed = new Set(available);
  const kept = savedKeys.map((key) => String(key)).filter((key) => allowed.has(key));
  if (kept.length === 0 && savedKeys.length > 0) return available;
  return kept;
}

export function recipientKeys(summary) {
  const seen = new Set();
  const keys = [];
  for (const col of summary?.slipColumns ?? []) {
    const key = String(col?.recipientUnitId ?? "none");
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export function filterOrderSummaryByRecipientUnits(summary, selectedKeys) {
  const allowed = new Set((selectedKeys ?? []).map((key) => String(key)));
  const slipColumns = (summary?.slipColumns ?? []).filter((col) => allowed.has(String(col?.recipientUnitId ?? "none")));

  const grandTotalsByCommodity = new Map();
  for (const col of slipColumns) {
    for (const line of col?.lines ?? []) {
      const quantity = Number(line?.quantity);
      if (!Number.isFinite(quantity)) continue;
      const prev = grandTotalsByCommodity.get(line.commodityId);
      if (prev) {
        prev.quantity += quantity;
        prev.quantityFormatted = formatQty(prev.quantity);
        continue;
      }
      grandTotalsByCommodity.set(line.commodityId, {
        commodityId: line.commodityId,
        name: line.name,
        measureUnit: line.measureUnit ?? null,
        quantity,
        quantityFormatted: formatQty(quantity),
      });
    }
  }

  return {
    ...(summary ?? {}),
    slipColumns,
    slipCount: slipColumns.length,
    grandTotals: Array.from(grandTotalsByCommodity.values()),
  };
}
