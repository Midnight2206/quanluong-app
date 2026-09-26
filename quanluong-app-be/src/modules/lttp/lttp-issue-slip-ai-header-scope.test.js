import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../errors/app-error.js";
import { scopeSanitizeIssueSlipAiHeaderDraft } from "./lttp-issue-slip-ai-header-scope.js";

test("scopeSanitize nulls LLM recipient/buyer outside branch and clears display names", async () => {
  const warnings = [];
  const out = await scopeSanitizeIssueSlipAiHeaderDraft(
    {
      recipientUnitId: 99,
      recipientDisplayName: "Unit X",
      recipientUserId: 7,
      buyerUserId: 3,
      buyerDisplayName: "Buyer",
      slipNote: "ok",
    },
    {
      effectiveUnitIds: [1, 2],
      storageUnitId: 1,
      warnings,
      deps: {
        assertUnitInBranch: (uid) => {
          if (Number(uid) !== 2) {
            throw new AppError({ message: "out", statusCode: 403 });
          }
        },
        assertBuyer: async () => {
          throw new AppError({ message: "bad buyer", statusCode: 400 });
        },
        assertRecipientUser: async () => ({}),
      },
    },
  );

  assert.equal(out.recipientUnitId, null);
  assert.equal(out.recipientDisplayName, null);
  assert.equal(out.recipientUserId, null);
  assert.equal(out.buyerUserId, null);
  assert.equal(out.buyerDisplayName, null);
  assert.equal(out.slipNote, "ok");
  assert.ok(warnings.some((w) => w.includes("Đơn vị nhận gợi ý")));
  assert.ok(warnings.some((w) => w.includes("Người mua")));
});

test("scopeSanitize applies validated request recipientUnitId when LLM omitted unit", async () => {
  const warnings = [];
  const out = await scopeSanitizeIssueSlipAiHeaderDraft(
    { recipientUnitId: null, slipNote: "a" },
    {
      effectiveUnitIds: [5],
      storageUnitId: 5,
      requestRecipientUnitId: 5,
      warnings,
      deps: {
        assertUnitInBranch: () => {},
        assertBuyer: async () => ({}),
        assertRecipientUser: async () => ({}),
      },
    },
  );

  assert.equal(out.recipientUnitId, 5);
  assert.equal(warnings.length, 0);
});

test("scopeSanitize rejects request recipientUnitId not in branch", async () => {
  const warnings = [];
  const out = await scopeSanitizeIssueSlipAiHeaderDraft(
    { recipientUnitId: null },
    {
      effectiveUnitIds: [1],
      storageUnitId: 1,
      requestRecipientUnitId: 8,
      warnings,
      deps: {
        assertUnitInBranch: () => {
          throw new AppError({ message: "out", statusCode: 403 });
        },
        assertBuyer: async () => ({}),
        assertRecipientUser: async () => ({}),
      },
    },
  );

  assert.equal(out.recipientUnitId, null);
  assert.ok(warnings.some((w) => w.includes("yêu cầu")));
});
