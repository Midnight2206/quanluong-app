import { normalizeCommodityName } from "../kitchen-books/kitchen-books-menu-ai-map.js";

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

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

const OMITTED_UOM = "*";

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

function findOmittedFromRule(rules, commodityId) {
  const confirmed = (rules || []).filter((rule) => rule.confirmed && rule.omitUsesFromUom);
  const exact = confirmed.filter((rule) => rule.commodityId === commodityId);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const shared = confirmed.filter((rule) => rule.commodityId == null);
  return shared.length === 1 ? shared[0] : null;
}

function convertQuantity({
  writtenQty,
  writtenUom,
  unitPrice,
  stockUom,
  habitUom,
  commodityId,
  rules,
  _allowImplicitFromRule = true,
  skipMoney = false, // true when writtenQty is already a number, not user-typed text
}) {
  const money = skipMoney ? null : parseMoneyAmount(writtenQty, writtenUom);
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
    if (_allowImplicitFromRule) {
      const implicitRule = findOmittedFromRule(rules, commodityId);
      if (implicitRule?.fromUom) {
        return convertQuantity({
          writtenQty,
          writtenUom: implicitRule.fromUom,
          unitPrice,
          stockUom,
          habitUom,
          commodityId,
          rules,
          _allowImplicitFromRule: false,
          skipMoney,
        });
      }
    }
    const omitted = findRule(rules, commodityId, OMITTED_UOM);
    if (omitted) {
      return {
        quantity: round4(qty * Number(omitted.factor)),
        measureUnit: stockUom || null,
        needsConfirm: false,
        source: "rule",
        factor: Number(omitted.factor),
        fromUom: "",
      };
    }
    if (usual && usual !== stock) {
      const habitRule = findRule(rules, commodityId, usual);
      if (habitRule) {
        return {
          quantity: round4(qty * Number(habitRule.factor)),
          measureUnit: stockUom || null,
          needsConfirm: false,
          source: "habit-uom",
          factor: Number(habitRule.factor),
          fromUom: String(habitUom || "").trim(),
        };
      }
    }
    return {
      quantity: qty,
      measureUnit: stockUom || null,
      needsConfirm: false,
      source: "as-written",
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
      quantity: round4(qty * Number(rule.factor)),
      measureUnit: stockUom || null,
      needsConfirm: false,
      source: "rule",
      factor: Number(rule.factor),
      fromUom: String(writtenUom || "").trim(),
    };
  }
  return {
    quantity: qty,
    measureUnit: writtenUom,
    needsConfirm: true,
    source: "unknown-uom",
  };
}

function bindSharedQtyRules(rules, commodities) {
  const byName = new Map(
    (commodities || [])
      .map((item) => [normalizeCommodityName(item?.name), item.id])
      .filter(([name]) => name),
  );
  const bound = [];
  for (const rule of rules || []) {
    if (!rule?.sharedLevel1) {
      bound.push(rule);
      continue;
    }
    if (!rule.commodityNameNorm) {
      bound.push({ ...rule, commodityId: null });
      continue;
    }
    const commodityId = byName.get(rule.commodityNameNorm);
    if (!commodityId) continue;
    bound.push({ ...rule, commodityId });
  }
  return bound;
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

export { OMITTED_UOM, bindSharedQtyRules, convertQuantity, normUom, parseMoneyAmount, proposeUomFactor };
