import assert from "node:assert/strict";
import test from "node:test";
import { commodityBlocks, recipientBlocks } from "./supplierLedgerView.js";

const lines = [
  {
    commodityId: 1,
    name: "Cải",
    measureUnit: "kg",
    quantityFormatted: "1",
    recipientId: "10",
    recipientName: "Bếp A",
    unitPrice: 12000,
    amount: 12000,
  },
  {
    commodityId: 1,
    name: "Cải",
    measureUnit: "kg",
    quantityFormatted: "2",
    recipientId: "11",
    recipientName: "Bếp B",
    unitPrice: 12000,
    amount: 24000,
  },
  {
    commodityId: 2,
    name: "Hành",
    measureUnit: "kg",
    quantityFormatted: "2",
    recipientId: "10",
    recipientName: "Bếp A",
    unitPrice: 8000,
    amount: 16000,
  },
];

test("commodity lines join recipient quantities and recipient lines join items", () => {
  const [cai] = commodityBlocks(lines);
  assert.equal(cai.name, "Cải");
  assert.deepEqual(cai.parts, ["1 kg (Bếp A)", "2 kg (Bếp B)"]);
  assert.equal(cai.amount, 36000);

  const [bepA] = recipientBlocks(lines);
  assert.equal(bepA.name, "Bếp A");
  assert.deepEqual(bepA.items, ["Cải: 1 kg × 12.000", "Hành: 2 kg × 8.000"]);
  assert.equal(bepA.amount, 28000);
});
