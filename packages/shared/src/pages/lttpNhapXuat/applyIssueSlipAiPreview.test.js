import assert from "node:assert/strict";
import test from "node:test";
import { applyIssueSlipAiPreview } from "./applyIssueSlipAiPreview.js";

test("apply copies the AI line note into the slip row", () => {
  const { nextRows } = applyIssueSlipAiPreview({
    touched: {},
    preview: {
      lines: [
        {
          mapped: true,
          commodityId: 10,
          quantity: 10,
          priceKind: "market",
          lttpSupplierId: 3,
          code: "GAO",
          lineNote: "4+6",
        },
      ],
    },
    newEmptyRow: () => ({ lineNote: "", commodityId: null }),
  });

  assert.equal(nextRows[0].lineNote, "4+6");
});

test("apply writes the original quantity when the preview note is empty", () => {
  const { nextRows } = applyIssueSlipAiPreview({
    touched: {},
    preview: {
      lines: [
        {
          mapped: true,
          commodityId: 8,
          quantity: 2,
          measureUnit: "kg",
          writtenQty: "1",
          writtenUom: "lít",
          priceKind: "market",
          lttpSupplierId: 3,
        },
      ],
    },
    newEmptyRow: () => ({ lineNote: "", commodityId: null }),
  });
  assert.equal(nextRows[0].quantity, "2");
  assert.equal(nextRows[0].lineNote, "1 lít");
});

test("apply does not write a money amount into the slip note", () => {
  const { nextRows } = applyIssueSlipAiPreview({
    touched: {},
    preview: {
      lines: [
        {
          mapped: true,
          commodityId: 8,
          quantity: 3,
          measureUnit: "kg",
          writtenQty: "15",
          writtenUom: "k",
          priceKind: "market",
          lttpSupplierId: 3,
        },
      ],
    },
    newEmptyRow: () => ({ lineNote: "", commodityId: null }),
  });
  assert.equal(nextRows[0].lineNote, "");
});
