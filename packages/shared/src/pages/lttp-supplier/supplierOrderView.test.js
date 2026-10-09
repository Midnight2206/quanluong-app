import assert from "node:assert/strict";
import test from "node:test";
import {
  filterOrderSummaryByRecipientUnits,
  initialSupplierId,
  pairLabel,
  nextRecipientSelection,
  recipientKeys,
} from "./supplierOrderView.js";

test("saved recipient picks stay when the units are still on the day", () => {
  assert.deepEqual(nextRecipientSelection(["10", "11"], ["10"]), ["10"]);
  assert.deepEqual(nextRecipientSelection(["10", "11"], []), []);
  assert.deepEqual(nextRecipientSelection(["10", "11"], null), ["10", "11"]);
  assert.deepEqual(nextRecipientSelection(["11"], ["10"]), ["11"]);
  assert.deepEqual(nextRecipientSelection([], ["10"]), ["10"]);
});

test("one link is selected and two links wait", () => {
  const one = [{ supplierId: 3, level1UnitName: "Kho", supplierName: "A" }];
  assert.equal(initialSupplierId(one), 3);
  assert.equal(initialSupplierId([...one, { supplierId: 4 }]), null);
  assert.equal(pairLabel(one[0]), "Kho — A");
});

test("recipient filter drops a column and rebuilds the total", () => {
  const summary = {
    slipColumns: [
      {
        slipId: 1,
        recipientUnitId: 10,
        recipientUnitName: "Đơn vị A",
        lines: [
          { commodityId: 1, name: "Gạo", measureUnit: "kg", quantity: 2, quantityFormatted: "2" },
        ],
      },
      {
        slipId: 2,
        recipientUnitId: 11,
        recipientUnitName: "Đơn vị B",
        lines: [
          { commodityId: 1, name: "Gạo", measureUnit: "kg", quantity: 1.5, quantityFormatted: "1.5" },
        ],
      },
    ],
    grandTotals: [{ commodityId: 1, name: "Gạo", measureUnit: "kg", quantity: 3.5, quantityFormatted: "3.5" }],
  };
  assert.deepEqual(recipientKeys(summary), ["10", "11"]);
  const filtered = filterOrderSummaryByRecipientUnits(summary, ["10"]);
  assert.equal(filtered.slipColumns.length, 1);
  assert.equal(filtered.grandTotals[0].quantityFormatted, "2");
  const none = filterOrderSummaryByRecipientUnits(summary, []);
  assert.equal(none.slipColumns.length, 0);
  assert.equal(none.grandTotals.length, 0);
});
