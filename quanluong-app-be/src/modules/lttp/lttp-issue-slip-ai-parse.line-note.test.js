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

test("parseOrderItems strips trailing parentheses before the LLM pick prompt", async () => {
  let pickPromptName = null;
  const { lines } = await parseOrderItems({
    ...baseArgs,
    text: "chuoi (30 qua)",
    commodities: [
      { id: 1, name: "Chuối tiêu", code: "CT", measureUnit: "kg" },
      { id: 2, name: "Chuối tây", code: "CX", measureUnit: "kg" },
    ],
    priceByCid: new Map([
      [1, { unitPrice: 1 }],
      [2, { unitPrice: 1 }],
    ]),
    complete: async (prompt) => {
      if (String(prompt?.system || "").includes("Tach tin dat hang")) {
        return { items: [{ name: "Chuối (30 quả)", quantity: "30", uom: "quả" }] };
      }
      pickPromptName = String(prompt?.user || "");
      return { sku: 1, conf: 0.9 };
    },
  });

  assert.match(pickPromptName, /Khach viet: Chuối\n/);
  assert.doesNotMatch(pickPromptName, /\(30 quả\)/);
  assert.equal(lines[0].commodityId, 1);
  assert.equal(lines[0].rawName, "Chuối");
});
