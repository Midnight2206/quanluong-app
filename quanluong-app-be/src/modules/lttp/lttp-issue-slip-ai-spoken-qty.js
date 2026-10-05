import { normalizeCommodityName } from "../kitchen-books/kitchen-books-menu-ai-map.js";
import { normUom } from "./lttp-issue-slip-ai-uom.js";

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

const RATIO = /(\d+(?:\.\d+)?)\s*(\p{L}+)\s*=\s*(\d+(?:\.\d+)?)\s*(\p{L}+)/u;

function cleanText(text) {
  return String(text ?? "").replace(/,/g, ".").replace(/\s+/g, " ").trim();
}

function parseSpokenQtyRule(text, stockUom) {
  const stock = normUom(stockUom);
  const raw = cleanText(text);
  if (!stock || !raw) return null;
  const match = RATIO.exec(raw);
  if (!match) return null;
  const leftQty = Number(match[1]);
  const rightQty = Number(match[3]);
  const leftUom = match[2];
  const rightUom = match[4];
  if (!(leftQty > 0) || !(rightQty > 0)) return null;
  const left = normUom(leftUom);
  const right = normUom(rightUom);
  if (left === right) return null;
  let fromUom;
  let factor;
  if (right === stock && left !== stock) {
    fromUom = leftUom;
    factor = rightQty / leftQty;
  } else if (left === stock && right !== stock) {
    fromUom = rightUom;
    factor = leftQty / rightQty;
  } else {
    return { error: "unit" };
  }
  factor = round4(factor);
  if (!(factor > 0) || factor > 500) return null;
  const omit = /không\s+(?:có|ghi)\s+đơn\s+vị(?:\s+tính)?[\s\S]{0,80}?(?:là|=)\s*(\p{L}+)/iu.exec(raw);
  return {
    fromUom,
    factor,
    omitUsesFromUom: Boolean(omit && normUom(omit[1]) === normUom(fromUom)),
  };
}

function resolveSpokenQtyRule({ message, lines, commodities }) {
  if (!RATIO.test(cleanText(message))) return { error: "none" };
  const open = (lines || []).filter((line) => Number(line.commodityId) > 0);
  let target = null;
  if (open.length === 1) target = open[0];
  else {
    const text = normalizeCommodityName(message);
    const hits = open.filter((line) => {
      const name = normalizeCommodityName(line.commodityName || "");
      return name && text.includes(name);
    });
    if (hits.length !== 1) return { error: "commodity" };
    target = hits[0];
  }
  const commodity = (commodities || []).find((item) => item.id === target.commodityId);
  const stockUom = commodity?.measureUnit || target.measureUnit;
  const parsed = parseSpokenQtyRule(message, stockUom);
  if (!parsed) return { error: "none" };
  if (parsed.error) return { error: parsed.error };
  return {
    rule: {
      type: "qty",
      fromUom: parsed.fromUom,
      factor: parsed.factor,
      omitUsesFromUom: parsed.omitUsesFromUom,
      lineId: target.id,
      commodityId: target.commodityId,
      commodityNameNorm: normalizeCommodityName(target.commodityName || "") || null,
    },
  };
}

export { parseSpokenQtyRule, resolveSpokenQtyRule };
