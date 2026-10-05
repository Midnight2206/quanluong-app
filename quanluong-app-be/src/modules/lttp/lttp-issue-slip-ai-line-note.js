import { normUom, parseMoneyAmount } from "./lttp-issue-slip-ai-uom.js";

const NOTE_LIMIT = 500;

function parseSumExpression(raw) {
  const compact = String(raw ?? "").replace(/\s+/g, "");
  if (!/^\d+(?:[.,]\d+)?(?:\+\d+(?:[.,]\d+)?)+$/.test(compact)) return null;
  const sum = compact.split("+").reduce((total, part) => total + Number(part.replace(",", ".")), 0);
  if (!Number.isFinite(sum) || sum <= 0) return null;
  return { expression: compact, sum };
}

function quantityTokenForConvert(writtenQty) {
  const expr = parseSumExpression(writtenQty);
  return expr ? String(expr.sum) : writtenQty;
}

function takeLastParen(name) {
  const text = String(name ?? "");
  const matches = [...text.matchAll(/\(([^)]*)\)/g)];
  if (!matches.length) return { name: text.trim(), parenText: null };
  const last = matches[matches.length - 1];
  const parenText = String(last[1] || "").trim();
  const stripped = text.replace(last[0], " ").replace(/\s+/g, " ").trim();
  return { name: stripped, parenText: parenText || null };
}

function unitsDiffer(a, b) {
  const left = normUom(a);
  const right = normUom(b);
  return Boolean(left) && Boolean(right) && left !== right;
}

function lineNoteForItem({ writtenQty, writtenUom, parenText, stockUom, originalQtyOnConvert }) {
  const expr = parseSumExpression(writtenQty);
  if (expr) return { lineNote: expr.expression.slice(0, NOTE_LIMIT) };
  const paren = String(parenText ?? "").trim();
  if (paren) return { lineNote: paren.slice(0, NOTE_LIMIT) };
  const qty = String(writtenQty ?? "").replace(/\s+/g, "");
  const uom = String(writtenUom ?? "").trim();
  if (
    originalQtyOnConvert &&
    parseMoneyAmount(qty, uom) == null &&
    /^\d+(?:[.,]\d+)?$/.test(qty) &&
    unitsDiffer(uom, stockUom)
  ) {
    return { lineNote: `${qty} ${uom}`.slice(0, NOTE_LIMIT) };
  }
  return { lineNote: "" };
}

export { lineNoteForItem, parseSumExpression, quantityTokenForConvert, takeLastParen };
