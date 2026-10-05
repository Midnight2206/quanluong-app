import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRuleSuggestion, qtyRuleOps, scopeQtyRule, validateAndResolvePatch } from "./lttp-issue-slip-ai-draft-patch.js";

const line = {
  id: 5,
  status: "sure",
  commodityId: 10,
  commodityName: "Gạo tẻ",
  code: "GAO",
  quantity: 2,
  measureUnit: "kg",
  lttpSupplierId: 3,
  unitPrice: 10000,
};
const sua = {
  id: 6,
  status: "needs_confirm",
  commodityId: null,
  commodityName: "sua",
  quantity: 1,
  measureUnit: "hop",
};

test("patch keeps a ticked line and drops the rest", () => {
  const { kept, dropped } = validateAndResolvePatch({
    tickedIds: [5],
    lines: [line, sua],
    commodities: [
      { id: 10, name: "Gạo tẻ", code: "GAO", measureUnit: "kg" },
      { id: 11, name: "Gạo nếp", code: "NEP", measureUnit: "kg" },
    ],
    rules: [],
    ops: [
      { line_id: 5, qty: 4 },
      { line_id: 9, qty: 1 },
      { line_id: 5, sku_id: 99 },
      { line_id: 6, qty: 2 },
      { line_id: 5, qty: 0 },
    ],
  });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].after.quantity, 4);
  assert.equal(kept[0].after.commodityId, 10);
  assert.equal(dropped.length, 4);
});

test("unit change uses the stored conversion rule", () => {
  const { kept, dropped } = validateAndResolvePatch({
    tickedIds: [5],
    lines: [{ ...line, measureUnit: "chai" }],
    commodities: [{ id: 10, name: "Gạo tẻ", code: "GAO", measureUnit: "chai" }],
    rules: [{ commodityId: 10, fromUom: "lo", factor: 12, confirmed: true }],
    ops: [{ line_id: 5, qty: 2, unit: "lo" }],
  });
  assert.equal(dropped.length, 0);
  assert.equal(kept[0].after.quantity, 24);
  assert.equal(kept[0].after.measureUnit, "chai");
});

test("qty chat rule scales the written amount onto the price-table unit", () => {
  const rule = scopeQtyRule(
    normalizeRuleSuggestion({ type: "qty", fromUom: "", factor: 10, line_id: 5 }),
    [{ ...line, writtenQty: "2", commodityName: "Gạo tẻ" }],
  );
  assert.equal(rule.fromUom, "*");
  assert.equal(rule.factor, 10);
  assert.equal(rule.commodityId, 10);
  const ops = qtyRuleOps(rule, [{ ...line, writtenQty: "2" }], [
    { id: 10, measureUnit: "hop" },
  ]);
  const { kept } = validateAndResolvePatch({
    tickedIds: [5],
    lines: [line],
    commodities: [{ id: 10, name: "Gạo tẻ", code: "GAO", measureUnit: "hop" }],
    rules: [],
    ops,
  });
  assert.equal(kept[0].after.quantity, 20);
  assert.equal(kept[0].after.measureUnit, "hop");
});

test("qty chat rule keeps the named input unit even when the omit flag is off", () => {
  const rule = {
    type: "qty",
    fromUom: "lit",
    factor: 6,
    omitUsesFromUom: false,
    lineId: 5,
    commodityId: 10,
  };
  const ops = qtyRuleOps(
    rule,
    [{ ...line, quantity: 8, measureUnit: "hộp", writtenQty: "8", writtenUom: null }],
    [{ id: 10, measureUnit: "hộp" }],
  );
  assert.equal(ops[0].qty, 48);
  assert.equal(ops[0].writtenUom, "lit");
});

test("qty chat rule scales addition expressions instead of skipping them", () => {
  const rule = scopeQtyRule(
    normalizeRuleSuggestion({ type: "qty", fromUom: "", factor: 2, line_id: 5 }),
    [{ ...line, writtenQty: "4+6", commodityName: "Gạo tẻ" }],
  );
  const ops = qtyRuleOps(rule, [{ ...line, writtenQty: "4+6" }], [
    { id: 10, measureUnit: "hop" },
  ]);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].qty, 20);
  assert.equal(ops[0].unit, "hop");
});

test("rule suggestion only keeps alias or a round uom factor", () => {
  assert.equal(normalizeRuleSuggestion({ type: "alias", raw: "sua", commodityId: 4 }).type, "alias");
  assert.equal(normalizeRuleSuggestion({ type: "uom", fromUom: "lo", factor: 12 }).factor, 12);
  assert.equal(normalizeRuleSuggestion({ type: "uom", fromUom: "lo", factor: 1.2 }), null);
  assert.equal(normalizeRuleSuggestion({ type: "note" }), null);
});

test("line note rule is a boolean and the old note type stays rejected", () => {
  assert.equal(normalizeRuleSuggestion({ type: "note" }), null);
  assert.deepEqual(normalizeRuleSuggestion({ type: "line_note", enabled: true }), {
    type: "line_note",
    enabled: true,
  });
  assert.equal(normalizeRuleSuggestion({ type: "line_note", enabled: "yes" }), null);
});

test("a decimal qty in the stock unit stays a quantity, not grouped thousands", () => {
  const { kept } = validateAndResolvePatch({
    tickedIds: [5],
    lines: [line],
    commodities: [{ id: 10, name: "Gạo tẻ", code: "GAO", measureUnit: "kg" }],
    rules: [],
    ops: [{ line_id: 5, qty: 0.625, unit: "kg", writtenUom: " quả " }],
  });
  assert.equal(kept[0].after.quantity, 0.625);
  assert.equal(kept[0].after.measureUnit, "kg");
  assert.equal(kept[0].after.writtenUom, "quả");
});
