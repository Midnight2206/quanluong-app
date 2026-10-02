import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRuleSuggestion, validateAndResolvePatch } from "./lttp-issue-slip-ai-draft-patch.js";

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

test("rule suggestion only keeps alias or a round uom factor", () => {
  assert.equal(normalizeRuleSuggestion({ type: "alias", raw: "sua", commodityId: 4 }).type, "alias");
  assert.equal(normalizeRuleSuggestion({ type: "uom", fromUom: "lo", factor: 12 }).factor, 12);
  assert.equal(normalizeRuleSuggestion({ type: "uom", fromUom: "lo", factor: 1.2 }), null);
  assert.equal(normalizeRuleSuggestion({ type: "note" }), null);
});
