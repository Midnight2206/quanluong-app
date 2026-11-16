import assert from "node:assert/strict";
import test from "node:test";
import { aggregateDailyInvoiceLines, INVOICE_VAT_NOTE } from "./lttp-supplier.invoice.js";

test("aggregateDailyInvoiceLines merges same commodity+price", () => {
  const { lines, grandTotal } = aggregateDailyInvoiceLines([
    { commodityId: 1, name: "Gạo", measureUnit: "kg", quantity: 2, unitPrice: 10000 },
    { commodityId: 1, name: "Gạo", measureUnit: "kg", quantity: 3, unitPrice: 10000 },
    { commodityId: 2, name: "Thịt", measureUnit: "kg", quantity: 1, unitPrice: 50000 },
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].name, "Gạo");
  assert.equal(lines[0].quantity, 5);
  assert.equal(lines[0].amount, 50000);
  assert.equal(grandTotal, 100000);
  assert.equal(INVOICE_VAT_NOTE.includes("GTGT"), true);
});
