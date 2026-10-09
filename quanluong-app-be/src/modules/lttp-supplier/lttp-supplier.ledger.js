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

function priceOf(prices, commodityId) {
  if (prices == null) return null;
  const raw = prices[commodityId] ?? prices[String(commodityId)];
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Gom dòng phiếu của một nhà cung cấp thành sổ theo ngày.
 * Đơn giá lấy từ bảng giá đối tác hiệu lực trong ngày. Thành tiền = số lượng × đơn giá.
 * @param {Array<{ date: string, recipientUnitId?: number|null, recipientUnitName?: string|null, lines?: Array<{ commodityId: number, name?: string, measureUnit?: string, quantity: number }> }>} slips
 * @param {Record<string, Record<string, number|null>>} priceByDate
 */
export function buildSupplierLedger(slips, priceByDate) {
  const merged = new Map();
  const recipients = new Map();

  for (const slip of slips ?? []) {
    const date = String(slip.date).slice(0, 10);
    const recipientId = slip.recipientUnitId == null ? "none" : String(slip.recipientUnitId);
    const recipientName = slip.recipientUnitName || "Chưa rõ đơn vị nhận";
    recipients.set(recipientId, recipientName);
    const prices = priceByDate?.[date];
    for (const line of slip.lines ?? []) {
      const qty = Number(line.quantity);
      const quantity = Number.isFinite(qty) ? qty : 0;
      const key = `${date}|${line.commodityId}|${recipientId}`;
      const prev = merged.get(key);
      if (prev) {
        prev.quantity += quantity;
        continue;
      }
      merged.set(key, {
        date,
        commodityId: line.commodityId,
        name: line.name || "Mặt hàng",
        measureUnit: line.measureUnit || "",
        recipientId,
        recipientName,
        quantity,
        unitPrice: priceOf(prices, line.commodityId),
      });
    }
  }

  const byDate = new Map();
  for (const row of merged.values()) {
    row.quantityFormatted = formatQty(row.quantity);
    row.amount = row.unitPrice == null ? 0 : roundMoney2(row.quantity * row.unitPrice);
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
  }

  const days = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, lines]) => {
      lines.sort((a, b) => a.name.localeCompare(b.name, "vi") || a.recipientName.localeCompare(b.recipientName, "vi"));
      const byRecipient = {};
      let total = 0;
      for (const line of lines) {
        byRecipient[line.recipientId] = roundMoney2((byRecipient[line.recipientId] || 0) + line.amount);
        total = roundMoney2(total + line.amount);
      }
      return { date, lines, byRecipient, total };
    });

  const recipientColumns = [...recipients.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  const columnTotals = {};
  let grandTotal = 0;
  for (const col of recipientColumns) {
    let sum = 0;
    for (const day of days) sum = roundMoney2(sum + (day.byRecipient[col.id] || 0));
    columnTotals[col.id] = sum;
    grandTotal = roundMoney2(grandTotal + sum);
  }

  return { days, recipientColumns, columnTotals, grandTotal };
}
