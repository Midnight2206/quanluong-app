/**
 * ponytail: merge rule check (mirrors buildTongHopDisplayRows).
 * Run: node packages/shared/src/pages/kitchen-books/kitchenReceiptSlipTongHop.selfcheck.mjs
 */
import assert from "node:assert/strict";

function roundMoney2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function normalizeKind(k) {
  return k === "tgsx" ? "tgsx" : "market";
}

function appliedPrice(r) {
  return normalizeKind(r.priceKind) === "tgsx" ? r.tgsxPrice : r.unitPrice;
}

function build(rows, guaranteeItems) {
  const buckets = new Map();
  function ensure(commodityId, code, price, fromIssue = false) {
    const p = roundMoney2(price);
    const key = `${commodityId}:${p}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        commodityId,
        appliedPrice: p,
        trenBdMarket: 0,
        trenBdTgsx: 0,
        donViMarket: 0,
        donViTgsx: 0,
        priceFromIssue: fromIssue,
      };
      buckets.set(key, b);
    } else if (fromIssue) {
      b.priceFromIssue = true;
    }
    return b;
  }
  for (const item of guaranteeItems) {
    const b = ensure(item.commodityId, item.commodityCode, item.appliedPrice, true);
    const q = Number(item.quantity);
    if (normalizeKind(item.priceKind) === "tgsx") b.trenBdTgsx += q;
    else b.trenBdMarket += q;
  }
  for (const r of rows) {
    const p = appliedPrice(r);
    const q = Number(r.quantity);
    const b = ensure(r.commodityId, r.codeDraft, p);
    if (normalizeKind(r.priceKind) === "tgsx") b.donViTgsx += q;
    else b.donViMarket += q;
  }
  return [...buckets.values()].map((b) => ({
    ...b,
    amount: roundMoney2(
      (b.trenBdMarket + b.trenBdTgsx + b.donViMarket + b.donViTgsx) * b.appliedPrice,
    ),
  }));
}

const out = build(
  [
    { commodityId: 1, quantity: "3", unitPrice: 1000, tgsxPrice: 800, priceKind: "market" },
    { commodityId: 1, quantity: "1", unitPrice: 1000, tgsxPrice: 800, priceKind: "market" },
    { commodityId: 2, quantity: "5", unitPrice: 2000, tgsxPrice: null, priceKind: "market" },
  ],
  [
    { commodityId: 1, priceKind: "market", appliedPrice: 1000, quantity: "2" },
    { commodityId: 1, priceKind: "tgsx", appliedPrice: 800, quantity: "1" },
  ],
);

assert.equal(out.length, 3);
const r1000 = out.find((r) => r.commodityId === 1 && r.appliedPrice === 1000);
assert.equal(r1000.trenBdMarket, 2);
assert.equal(r1000.donViMarket, 4);
assert.equal(r1000.amount, 6000);
const r800 = out.find((r) => r.commodityId === 1 && r.appliedPrice === 800);
assert.equal(r800.trenBdTgsx, 1);
assert.equal(r800.amount, 800);
assert.equal(out.find((r) => r.commodityId === 2).donViMarket, 5);
console.log("kitchenReceiptSlipTongHop.selfcheck: ok");
