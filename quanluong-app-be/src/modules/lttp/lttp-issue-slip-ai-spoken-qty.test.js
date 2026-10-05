import assert from "node:assert/strict";
import test from "node:test";
import { parseSpokenQtyRule, resolveSpokenQtyRule } from "./lttp-issue-slip-ai-spoken-qty.js";

test("both sentence shapes become 0.0625 kg per quả", () => {
  assert.deepEqual(parseSpokenQtyRule("1 quả = 0,0625 kg", "kg"), {
    fromUom: "quả",
    factor: 0.0625,
    omitUsesFromUom: false,
  });
  assert.deepEqual(parseSpokenQtyRule("16 quả = 1 kg", "kg"), {
    fromUom: "quả",
    factor: 0.0625,
    omitUsesFromUom: false,
  });
  assert.deepEqual(parseSpokenQtyRule("1 kg = 16 quả", "kg"), {
    fromUom: "quả",
    factor: 0.0625,
    omitUsesFromUom: false,
  });
  assert.equal(parseSpokenQtyRule("1 thùng = 12 cái", "cái").factor, 12);
  assert.equal(parseSpokenQtyRule("2 lo", "kg"), null);
});

test("the same sentence can name the omitted unit", () => {
  const parsed = parseSpokenQtyRule(
    "trứng chat không có đơn vị tính phía sau thì đơn vị tính là quả và 16 quả = 1 kg",
    "kg",
  );
  assert.equal(parsed.omitUsesFromUom, true);
  assert.equal(parsed.fromUom, "quả");
  assert.equal(parseSpokenQtyRule("16 quả = 1 kg", "kg").omitUsesFromUom, false);
});

test("a ratio whose units miss the stock unit is an error", () => {
  assert.deepEqual(parseSpokenQtyRule("16 quả = 1 hộp", "kg"), { error: "unit" });
  assert.equal(parseSpokenQtyRule("1 kg = 1 kg", "kg"), null);
});

test("resolve uses the asked line, otherwise one whole commodity name", () => {
  const lines = [
    { id: 1, commodityId: 8, commodityName: "Trứng gà", measureUnit: "kg" },
    { id: 2, commodityId: 9, commodityName: "Trứng vịt", measureUnit: "kg" },
  ];
  const commodities = [
    { id: 8, name: "Trứng gà", measureUnit: "kg" },
    { id: 9, name: "Trứng vịt", measureUnit: "kg" },
  ];
  const asked = resolveSpokenQtyRule({
    message: "16 quả = 1 kg",
    lines: [lines[0]],
    commodities,
  });
  assert.equal(asked.rule.commodityId, 8);
  assert.equal(asked.rule.factor, 0.0625);
  assert.equal(asked.rule.lineId, 1);
  assert.deepEqual(
    resolveSpokenQtyRule({ message: "trứng 16 quả = 1 kg", lines, commodities }),
    { error: "commodity" },
  );
  const named = resolveSpokenQtyRule({
    message: "trứng gà 16 quả = 1 kg",
    lines,
    commodities,
  });
  assert.equal(named.rule.commodityId, 8);
  assert.equal(named.rule.commodityNameNorm.includes("trung"), true);
});
