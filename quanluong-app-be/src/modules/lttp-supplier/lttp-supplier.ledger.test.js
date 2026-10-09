import assert from "node:assert/strict";
import test from "node:test";
import { buildSupplierLedger } from "./lttp-supplier.ledger.js";

test("ledger multiplies quantity by the partner price and totals each day", () => {
  const ledger = buildSupplierLedger(
    [
      {
        date: "2026-10-08",
        recipientUnitId: 10,
        recipientUnitName: "Bếp A",
        lines: [
          { commodityId: 1, name: "Cải", measureUnit: "kg", quantity: 1 },
          { commodityId: 2, name: "Hành", measureUnit: "kg", quantity: 2 },
        ],
      },
      {
        date: "2026-10-08",
        recipientUnitId: 11,
        recipientUnitName: "Bếp B",
        lines: [{ commodityId: 1, name: "Cải", measureUnit: "kg", quantity: 2 }],
      },
    ],
    { "2026-10-08": { 1: 12000, 2: 8000 } },
  );

  assert.equal(ledger.days.length, 1);
  assert.equal(ledger.days[0].byRecipient["10"], 28000);
  assert.equal(ledger.days[0].byRecipient["11"], 24000);
  assert.equal(ledger.days[0].total, 52000);
  assert.equal(ledger.grandTotal, 52000);
  assert.deepEqual(
    ledger.days[0].lines.map((line) => [line.name, line.recipientName, line.quantityFormatted, line.amount]),
    [
      ["Cải", "Bếp A", "1", 12000],
      ["Cải", "Bếp B", "2", 24000],
      ["Hành", "Bếp A", "2", 16000],
    ],
  );
});
