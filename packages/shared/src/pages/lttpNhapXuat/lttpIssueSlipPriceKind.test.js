import test from "node:test";
import assert from "node:assert/strict";

import {
  LTTP_ISSUE_SLIP_PRICE_KIND,
  collectIssueSlipFormLineIssues,
  hasIssueSlipFormLineIssues,
  isIssueSlipLineInvalid,
  normalizeIssueSlipPriceKind,
  resolveIssueSlipAppliedUnitPrice,
  suggestPriceKindForDuplicateCommodity,
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

test("suggestPriceKindForDuplicateCommodity flips TT/TGSX on second row", () => {
  const rows = [
    { key: "a", commodityId: 1, priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.MARKET },
  ];
  assert.equal(
    suggestPriceKindForDuplicateCommodity(rows, "b", 1, { tgsxAvailable: true }),
    LTTP_ISSUE_SLIP_PRICE_KIND.TGSX,
  );
  assert.equal(
    suggestPriceKindForDuplicateCommodity(
      [{ key: "a", commodityId: 1, priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.TGSX }],
      "b",
      1,
      { tgsxAvailable: true },
    ),
    LTTP_ISSUE_SLIP_PRICE_KIND.MARKET,
  );
});

test("issue slip line issues: same commodity different kinds is OK", () => {
  const rows = [
    { key: "a", commodityId: 1, priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.MARKET },
    { key: "b", commodityId: 1, priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.TGSX },
  ];
  const issues = collectIssueSlipFormLineIssues(rows);
  assert.equal(hasIssueSlipFormLineIssues(issues), false);
  assert.equal(isIssueSlipLineInvalid(rows[0], issues), false);
});

test("issue slip line issues: same commodity and same price kind", () => {
  const rows = [
    { key: "a", commodityId: 5, priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.MARKET },
    { key: "b", commodityId: 5, priceKind: "market" },
  ];
  const issues = collectIssueSlipFormLineIssues(rows);
  assert.equal(hasIssueSlipFormLineIssues(issues), true);
  assert.equal(isIssueSlipLineInvalid(rows[0], issues), true);
  assert.equal(isIssueSlipLineInvalid(rows[1], issues), true);
});

test("issue slip line issues: third row with same commodity", () => {
  const rows = [
    { key: "a", commodityId: 2, priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.MARKET },
    { key: "b", commodityId: 2, priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.TGSX },
    { key: "c", commodityId: 2, priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.MARKET },
  ];
  const issues = collectIssueSlipFormLineIssues(rows);
  assert.equal(issues.tripleCommodityIds.has(2), true);
  assert.equal(hasIssueSlipFormLineIssues(issues), true);
  assert.equal(isIssueSlipLineInvalid(rows[2], issues), true);
});
