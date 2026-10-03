import assert from "node:assert/strict";
import test from "node:test";

import { parseOrderItems } from "./lttp-issue-slip-ai-parse.js";

const commodities = [{ id: 1, name: "Chu\u1ed1i", code: "CH", measureUnit: "kg" }];
const priceByCid = new Map([[1, { unitPrice: 1 }]]);
const resolveLine = () => ({ lttpSupplierId: 1, unitPrice: 1, tgsxPrice: null });
const complete = async () => ({
  items: [{ name: "Chu\u1ed1i", quantity: "30", uom: "qu\u1ea3" }],
});

const baseArgs = {
  text: "30 qua chuoi",
  commodities,
  habits: [],
  aliases: [],
  rules: [],
  examples: [],
  includeExamples: false,
  priceByCid,
  resolveLine,
  complete,
};

test("parseOrderItems lineNote when originalQtyOnConvert is true", async () => {
  const { lines } = await parseOrderItems({ ...baseArgs, originalQtyOnConvert: true });
  assert.equal(lines[0].lineNote, "30 qu\u1ea3");
});

test("parseOrderItems lineNote when originalQtyOnConvert is false", async () => {
  const { lines } = await parseOrderItems({ ...baseArgs, originalQtyOnConvert: false });
  assert.equal(lines[0].lineNote, "");
});
