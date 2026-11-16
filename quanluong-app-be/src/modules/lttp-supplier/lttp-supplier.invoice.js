function roundMoney2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function formatQty(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const text = x.toFixed(4).replace(/\.?0+$/, "");
  return text === "" ? "0" : text;
}

/**
 * Gộp dòng ledger trong 1 ngày theo commodityId + unitPrice.
 * @param {Array<{ commodityId: number, name?: string, measureUnit?: string, quantity: number, unitPrice: number|null, amount?: number }>} lines
 */
export function aggregateDailyInvoiceLines(lines) {
  const merged = new Map();
  for (const line of lines ?? []) {
    const commodityId = Number(line.commodityId);
    const unitPrice = line.unitPrice == null ? null : Number(line.unitPrice);
    const key = `${commodityId}|${unitPrice == null ? "" : unitPrice}`;
    const qty = Number(line.quantity);
    const quantity = Number.isFinite(qty) ? qty : 0;
    const prev = merged.get(key);
    if (prev) {
      prev.quantity += quantity;
      continue;
    }
    merged.set(key, {
      commodityId,
      name: line.name || "Mặt hàng",
      measureUnit: line.measureUnit || "",
      quantity,
      unitPrice: unitPrice != null && Number.isFinite(unitPrice) ? unitPrice : null,
    });
  }

  const rows = [...merged.values()]
    .map((row) => {
      const amount = row.unitPrice == null ? 0 : roundMoney2(row.quantity * row.unitPrice);
      return {
        ...row,
        quantityFormatted: formatQty(row.quantity),
        amount,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  let grandTotal = 0;
  for (const row of rows) grandTotal = roundMoney2(grandTotal + row.amount);
  return { lines: rows, grandTotal };
}

export const INVOICE_VAT_NOTE = "Hoá đơn đã bao gồm thuế GTGT";
