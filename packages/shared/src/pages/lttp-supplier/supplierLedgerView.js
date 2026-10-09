export function formatLedgerMoney(amount) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(amount) || 0);
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
