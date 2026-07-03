import test from "node:test";
import assert from "node:assert/strict";

import {
  LTTP_ISSUE_SLIP_PRICE_KIND,
  normalizeIssueSlipPriceKind,
  resolveIssueSlipAppliedUnitPrice,
} from "./lttpIssueSlipPriceKind.js";

test("resolveIssueSlipAppliedUnitPrice uses market or tgsx snapshot", () => {
  assert.equal(
    resolveIssueSlipAppliedUnitPrice({
      priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.MARKET,
      unitPrice: 10000,
      tgsxPrice: 8000,
    }),
    10000,
  );
  assert.equal(
    resolveIssueSlipAppliedUnitPrice({
      priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.TGSX,
      unitPrice: 10000,
      tgsxPrice: 8000,
    }),
    8000,
  );
  assert.equal(normalizeIssueSlipPriceKind("TGSX"), LTTP_ISSUE_SLIP_PRICE_KIND.TGSX);
  assert.equal(normalizeIssueSlipPriceKind(undefined), LTTP_ISSUE_SLIP_PRICE_KIND.MARKET);
});
