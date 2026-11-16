export function formatLedgerMoney(amount) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(amount) || 0);
}

function roundMoney2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function qtyLabel(line) {
  return line.measureUnit ? `${line.quantityFormatted} ${line.measureUnit}` : line.quantityFormatted;
}

function priceLabel(unitPrice) {
  return unitPrice == null ? "—" : formatLedgerMoney(unitPrice);
}

/** Mỗi mặt hàng một dòng: số lượng (đơn vị nhận) + … */
export function commodityBlocks(lines) {
  const groups = new Map();
  for (const line of lines ?? []) {
    const key = `${line.commodityId}|${line.unitPrice ?? ""}`;
    if (!groups.has(key)) {
      groups.set(key, { name: line.name, unitPrice: line.unitPrice, parts: [], amount: 0 });
    }
    const group = groups.get(key);
    group.parts.push(`${qtyLabel(line)} (${line.recipientName})`);
    group.amount += Number(line.amount) || 0;
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/** Mỗi đơn vị nhận một khối: mặt hàng: số lượng × đơn giá + … */
export function recipientBlocks(lines) {
  const groups = new Map();
  for (const line of lines ?? []) {
    if (!groups.has(line.recipientId)) {
      groups.set(line.recipientId, { name: line.recipientName, items: [], amount: 0 });
    }
    const group = groups.get(line.recipientId);
    group.items.push(`${line.name}: ${qtyLabel(line)} × ${priceLabel(line.unitPrice)}`);
    group.amount += Number(line.amount) || 0;
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/** Cột bảng theo mặt hàng (toàn kỳ). */
export function commodityColumns(days) {
  const map = new Map();
  for (const day of days ?? []) {
    for (const line of day.lines ?? []) {
      const id = String(line.commodityId);
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: line.name || "Mặt hàng",
          measureUnit: line.measureUnit || "",
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/** Thành tiền theo commodityId trong 1 ngày. */
export function dayByCommodity(day) {
  const by = {};
  for (const line of day?.lines ?? []) {
    const id = String(line.commodityId);
    by[id] = roundMoney2((by[id] || 0) + (Number(line.amount) || 0));
  }
  return by;
}

/** Tổng cột mặt hàng trên cả kỳ. */
export function commodityColumnTotals(days, columns) {
  const totals = {};
  for (const col of columns ?? []) totals[col.id] = 0;
  for (const day of days ?? []) {
    const by = dayByCommodity(day);
    for (const col of columns ?? []) {
      totals[col.id] = roundMoney2((totals[col.id] || 0) + (by[col.id] || 0));
    }
  }
  return totals;
}
