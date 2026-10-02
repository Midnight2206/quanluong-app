function normUom(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function parseMoneyAmount(quantity, uom) {
  const qty = String(quantity ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const unit = normUom(uom);
  if (/^(k|nghin|ngan)$/.test(unit) && /^\d+(?:[.,]\d+)?$/.test(qty)) {
    return Number(qty.replace(",", ".")) * 1000;
  }
  const k = /^(\d+(?:[.,]\d+)?)k$/.exec(qty);
  if (k) return Number(k[1].replace(",", ".")) * 1000;
  const grouped = /^(\d{1,3}(?:\.\d{3})+)(?:đ|d|dong|vnd)?$/.exec(qty);
  if (grouped) return Number(grouped[1].replace(/\./g, ""));
  return null;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function findRule(rules, commodityId, fromUom) {
  const confirmed = (rules || []).filter(
    (rule) => rule.confirmed && normUom(rule.fromUom) === fromUom,
  );
  return (
    confirmed.find((rule) => rule.commodityId === commodityId) ||
    confirmed.find((rule) => rule.commodityId == null) ||
    null
  );
}

function convertQuantity({
  writtenQty,
  writtenUom,
  unitPrice,
  stockUom,
  habitUom,
  commodityId,
  rules,
}) {
  const money = parseMoneyAmount(writtenQty, writtenUom);
  if (money != null) {
    if (!(Number(unitPrice) > 0)) {
      return { quantity: null, measureUnit: stockUom || null, needsConfirm: true, source: "money" };
    }
    return {
      quantity: round1(money / Number(unitPrice)),
      measureUnit: stockUom || habitUom || null,
      needsConfirm: false,
      source: "money",
    };
  }
  const qty = Number(String(writtenQty ?? "").replace(",", "."));
  if (!Number.isFinite(qty) || qty <= 0) {
    return { quantity: null, measureUnit: stockUom || null, needsConfirm: true, source: "invalid" };
  }
  const from = normUom(writtenUom);
  const stock = normUom(stockUom);
  const usual = normUom(habitUom) || stock;
  if (!from) {
    if (!usual || usual === stock) {
      return {
        quantity: qty,
        measureUnit: stockUom || habitUom || null,
        needsConfirm: false,
        source: "as-written",
      };
    }
    const habitRule = findRule(rules, commodityId, usual);
    if (habitRule) {
      return {
        quantity: round1(qty * Number(habitRule.factor)),
        measureUnit: stockUom || null,
        needsConfirm: false,
        source: "habit-uom",
      };
    }
    return {
      quantity: qty,
      measureUnit: habitUom,
      needsConfirm: true,
      source: "habit-uom",
    };
  }
  if (from === stock) {
    return {
      quantity: qty,
      measureUnit: stockUom || writtenUom,
      needsConfirm: false,
      source: "as-written",
    };
  }
  const rule = findRule(rules, commodityId, from);
  if (rule) {
    return {
      quantity: round1(qty * Number(rule.factor)),
      measureUnit: stockUom || null,
      needsConfirm: false,
      source: "rule",
    };
  }
  return {
    quantity: qty,
    measureUnit: writtenUom,
    needsConfirm: true,
    source: "unknown-uom",
  };
}

function proposeUomFactor(writtenQty, writtenUom, stockQty, stockUom) {
  const written = Number(writtenQty);
  const stock = Number(stockQty);
  const from = normUom(writtenUom);
  const to = normUom(stockUom);
  if (!(written > 0) || !(stock > 0) || !from || from === to) return null;
  const factor = stock / written;
  const rounded = Math.round(factor);
  if (rounded < 2 || rounded > 500 || Math.abs(factor - rounded) > 0.05) return null;
  return rounded;
}

export { convertQuantity, parseMoneyAmount, proposeUomFactor };
