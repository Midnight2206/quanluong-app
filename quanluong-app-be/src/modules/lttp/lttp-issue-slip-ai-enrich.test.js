import assert from "node:assert/strict";
import test from "node:test";
import { enrichLlmIssueSlipDraft } from "./lttp-issue-slip-ai-enrich.js";

const commodities = [
  { id: 10, name: "Gạo tẻ", code: "GAO" },
  { id: 20, name: "Thịt heo", code: "TH" },
];

test("enrichLlmIssueSlipDraft maps known commodity and leaves unknown unmapped", () => {
  const resolveCalls = [];
  const { headerDraft, lines, warnings } = enrichLlmIssueSlipDraft({
    llm: {
      header: { slipNote: "  ghi chú  ", issueDate: "2026-09-26" },
      lines: [
        { commodityName: "Gạo tẻ", code: "GAO", quantity: 5, priceKind: "market" },
        { commodityName: "Không có", code: "XXX", quantity: 1, priceKind: "market" },
      ],
    },
    commodities,
    resolveLine: (args) => {
      resolveCalls.push(args);
      return { lttpSupplierId: 99, unitPrice: 12000 };
    },
  });

  assert.equal(headerDraft.slipNote, "ghi chú");
  assert.equal(headerDraft.issueDate, "2026-09-26");
  assert.equal(headerDraft.recipientUnitId, null);

  assert.equal(lines.length, 2);
  assert.equal(lines[0].commodityId, 10);
  assert.equal(lines[0].mapped, true);
  assert.equal(lines[0].lttpSupplierId, 99);
  assert.equal(lines[0].unitPrice, 12000);
  assert.equal(lines[0].priceKind, "market");

  assert.equal(lines[1].commodityId, null);
  assert.equal(lines[1].mapped, false);
  assert.equal(resolveCalls.length, 1);
  assert.deepEqual(resolveCalls[0], { commodityId: 10, priceKind: "market", code: "GAO" });
  assert.ok(warnings.some((w) => w.includes("Không có") || w.includes("XXX")));
});

test("enrichLlmIssueSlipDraft dedupes duplicate commodityId+priceKind keeping first", () => {
  const { lines, warnings } = enrichLlmIssueSlipDraft({
    llm: {
      header: {},
      lines: [
        { commodityName: "GAO", quantity: 2, priceKind: "market" },
        { commodityName: "Gạo tẻ", quantity: 9, priceKind: "market" },
      ],
    },
    commodities,
    resolveLine: () => ({ lttpSupplierId: 1, unitPrice: 100 }),
  });

  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 2);
  assert.ok(warnings.some((w) => w.toLowerCase().includes("trùng") || w.includes("duplicate")));
});

test("enrichLlmIssueSlipDraft mapped false without supplier from resolveLine", () => {
  const { lines } = enrichLlmIssueSlipDraft({
    llm: {
      header: {},
      lines: [{ commodityName: "Thịt heo", quantity: 3, priceKind: "tgsx" }],
    },
    commodities,
    resolveLine: () => ({ lttpSupplierId: null, unitPrice: 50000 }),
  });

  assert.equal(lines[0].priceKind, "tgsx");
  assert.equal(lines[0].mapped, false);
});
