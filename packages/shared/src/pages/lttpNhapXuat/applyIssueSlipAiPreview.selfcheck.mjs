/**
 * Run: node packages/shared/src/pages/lttpNhapXuat/applyIssueSlipAiPreview.selfcheck.mjs
 */
import assert from "node:assert/strict";
import { applyIssueSlipAiPreview } from "./applyIssueSlipAiPreview.js";
import { LTTP_ISSUE_SLIP_PRICE_KIND } from "./lttpIssueSlipPriceKind.js";

function mockNewEmptyRow() {
  return {
    key: `r_test_${Math.random().toString(36).slice(2, 9)}`,
    commodityId: "",
    codeDraft: "",
    lttpSupplierId: "",
    requiredQuantity: "",
    quantity: "1",
    unitPrice: null,
    tgsxPrice: null,
    priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.MARKET,
    lineNote: "",
  };
}

function goodLine(overrides = {}) {
  return {
    commodityId: 10,
    commodityName: "Gạo",
    code: "GAO01",
    quantity: 2.5,
    priceKind: "market",
    lttpSupplierId: 3,
    unitPrice: 15000,
    tgsxPrice: null,
    mapped: true,
    ...overrides,
  };
}

const header = {
  issueDate: "2026-09-01",
  receivedDate: "2026-09-02",
  recipientUnitId: 99,
};

const touched = {
  issueDate: true,
  receivedDate: false,
  recipientUnitId: false,
  buyerUserId: false,
  slipNote: false,
};

const preview = {
  headerDraft: {
    issueDate: "2026-09-10",
    receivedDate: "2026-09-11",
    recipientUnitId: 42,
    recipientDisplayName: "ĐV nhận AI",
    buyerUserId: null,
    slipNote: null,
  },
  lines: [
    goodLine(),
    goodLine({ priceKind: "tgsx", tgsxPrice: 12000, unitPrice: 15000 }),
    goodLine({ mapped: false, commodityId: null }),
    goodLine({ lttpSupplierId: null, mapped: true }),
    goodLine({ quantity: 0, mapped: true }),
  ],
};

const out = applyIssueSlipAiPreview({
  header,
  touched,
  preview,
  newEmptyRow: mockNewEmptyRow,
});

assert.equal(out.headerPatch.issueDate, undefined, "touched issueDate not patched");
assert.equal(out.headerPatch.receivedDate, "2026-09-11");
assert.equal(out.headerPatch.recipientUnitId, 42);
assert.equal(out.headerPatch.recipientDisplayName, "ĐV nhận AI");

assert.equal(out.appliedCount, 2);
assert.equal(out.skippedCount, 3);
assert.equal(out.nextRows.length, 2);

for (const row of out.nextRows) {
  assert.equal(typeof row.commodityId, "string");
  assert.equal(row.commodityId, "10");
  assert.equal(typeof row.lttpSupplierId, "string");
  assert.equal(row.lttpSupplierId, "3");
  assert.equal(typeof row.quantity, "string");
  assert.equal(row.codeDraft, "GAO01");
  assert.equal(row.requiredQuantity, "");
  assert.equal(row.lineNote, "");
}

assert.equal(out.nextRows[0].quantity, "2.5");
assert.equal(out.nextRows[0].priceKind, LTTP_ISSUE_SLIP_PRICE_KIND.MARKET);
assert.equal(out.nextRows[0].unitPrice, 15000);
assert.equal(out.nextRows[1].priceKind, LTTP_ISSUE_SLIP_PRICE_KIND.TGSX);

const emptyApply = applyIssueSlipAiPreview({
  header: {},
  touched: {},
  preview: { headerDraft: {}, lines: [goodLine({ mapped: false })] },
  newEmptyRow: mockNewEmptyRow,
});
assert.equal(emptyApply.appliedCount, 0);
assert.equal(emptyApply.skippedCount, 1);
assert.equal(emptyApply.nextRows.length, 1);
assert.equal(emptyApply.nextRows[0].commodityId, "");

console.log("applyIssueSlipAiPreview: ok");
