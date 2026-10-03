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
