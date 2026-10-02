import assert from "node:assert/strict";
import test from "node:test";
import { applyLlmPick, decideMatch, pickAlias } from "./lttp-issue-slip-ai-match.js";
import { bindSharedQtyRules, convertQuantity, parseMoneyAmount, proposeUomFactor } from "./lttp-issue-slip-ai-uom.js";

const gao = { id: 10, name: "Gạo tẻ", code: "GAO", measureUnit: "kg" };
const nep = { id: 11, name: "Gạo nếp", code: "NEP", measureUnit: "kg" };

test("alias at 80 percent fills without scoring", () => {
  const hit = pickAlias(
    [
      { rawNorm: "gao te", commodityId: 10, hitCount: 8 },
      { rawNorm: "gao te", commodityId: 11, hitCount: 2 },
    ],
    "Gạo tẻ",
  );
  assert.equal(hit.commodityId, 10);
  assert.equal(hit.source, "alias");
});

test("score auto-fills when the top habit is clearly ahead", () => {
  const decision = decideMatch({
    rawName: "gao te",
    commodities: [gao, nep],
    habits: [
      {
        commodityId: 10,
        measureUnit: "kg",
        orderCount: 12,
        lastOrderedAt: new Date(),
        qtySamples: [2],
      },
    ],
    aliases: [],
    now: new Date(),
  });
  assert.equal(decision.source, "score");
  assert.equal(decision.commodityId, 10);
  assert.equal(decision.needsLlm, false);
});

test("close names stay for the LLM shortlist", () => {
  const decision = decideMatch({
    rawName: "gao",
    commodities: [gao, nep],
    habits: [
      { commodityId: 10, orderCount: 5, lastOrderedAt: new Date(), measureUnit: "kg", qtySamples: [] },
      { commodityId: 11, orderCount: 5, lastOrderedAt: new Date(), measureUnit: "kg", qtySamples: [] },
    ],
    aliases: [],
    now: new Date(),
  });
  assert.equal(decision.needsLlm, true);
  assert.ok(decision.choices.length >= 2);
  assert.ok(decision.choices.length <= 5);
});

test("LLM pick below 0.7 or outside the list needs confirmation", () => {
  const decision = {
    needsLlm: true,
    choices: [
      { commodityId: 10, name: "Gạo tẻ" },
      { commodityId: 11, name: "Gạo nếp" },
    ],
  };
  assert.equal(applyLlmPick(decision, { sku: 10, conf: 0.69 }).needsConfirm, true);
  assert.equal(applyLlmPick(decision, { sku: 99, conf: 0.9 }).needsConfirm, true);
  assert.equal(applyLlmPick(decision, { sku: 10, conf: 0.7 }).source, "llm");
});

test("15k becomes the quantity whose amount is nearest 15000, one decimal", () => {
  assert.equal(parseMoneyAmount("15k", ""), 15000);
  const converted = convertQuantity({
    writtenQty: "15k",
    writtenUom: "",
    unitPrice: 12000,
    stockUom: "kg",
  });
  assert.equal(converted.quantity, 1.3);
  assert.equal(converted.source, "money");
});

test("missing unit uses the unit this recipient usually orders", () => {
  const converted = convertQuantity({
    writtenQty: "2",
    writtenUom: "",
    stockUom: "chai",
    habitUom: "thung",
    commodityId: 4,
    rules: [{ commodityId: null, fromUom: "thung", factor: 12, confirmed: true }],
  });
  assert.equal(converted.quantity, 24);
  assert.equal(converted.source, "habit-uom");
  assert.equal(converted.factor, 12);
  assert.equal(converted.fromUom, "thung");
});

test("missing unit with no rule stays in the system unit", () => {
  const converted = convertQuantity({
    writtenQty: "15",
    writtenUom: "",
    stockUom: "qua",
    habitUom: "vi",
    commodityId: 4,
    rules: [],
  });
  assert.equal(converted.quantity, 15);
  assert.equal(converted.measureUnit, "qua");
  assert.equal(converted.needsConfirm, false);
});

test("known conversion multiplies; unknown unit asks", () => {
  const known = convertQuantity({
    writtenQty: "2",
    writtenUom: "lo",
    stockUom: "chai",
    commodityId: 4,
    rules: [{ commodityId: 4, fromUom: "lo", factor: 12, confirmed: true }],
  });
  assert.equal(known.quantity, 24);
  assert.equal(known.factor, 12);
  assert.equal(known.fromUom, "lo");
  const unknown = convertQuantity({
    writtenQty: "2",
    writtenUom: "lo",
    stockUom: "chai",
    commodityId: 4,
    rules: [],
  });
  assert.equal(unknown.needsConfirm, true);
});

test("omitted unit uses the shared qty rule before the habit unit", () => {
  const converted = convertQuantity({
    writtenQty: "3",
    writtenUom: "",
    stockUom: "hop",
    habitUom: "thung",
    commodityId: 8,
    rules: [{ commodityId: 8, fromUom: "*", factor: 1, confirmed: true }],
  });
  assert.equal(converted.quantity, 3);
  assert.equal(converted.measureUnit, "hop");
  assert.equal(converted.source, "rule");
});

test("shared qty rule binds by commodity name inside each warehouse", () => {
  const bound = bindSharedQtyRules(
    [{ sharedLevel1: true, commodityNameNorm: "gao te", commodityId: 99, fromUom: "*", factor: 10, confirmed: true }],
    [{ id: 4, name: "Gạo tẻ" }],
  );
  assert.equal(bound[0].commodityId, 4);
});

test("factor proposal only for a round integer", () => {
  assert.equal(proposeUomFactor(2, "lo", 24, "chai"), 12);
  assert.equal(proposeUomFactor(2, "lo", 25, "chai"), null);
  assert.equal(proposeUomFactor(2, "chai", 2, "chai"), null);
});
