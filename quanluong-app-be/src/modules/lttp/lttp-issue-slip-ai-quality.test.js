import assert from "node:assert/strict";
import test from "node:test";
import { summarizeLttpAiQuality } from "./lttp-issue-slip-ai-quality.js";

test("empty committed drafts report zeros", () => {
  assert.deepEqual(summarizeLttpAiQuality({ drafts: [{ status: "editing", lines: [{}] }] }), {
    slips: 0,
    lines: 0,
    pctCorrectNoEdit: 0,
    pctNeedsConfirm: 0,
    pctEditedBySource: { alias: 0, score: 0, llm: 0, other: 0 },
    meanChatTurns: 0,
    meanLlmCalls: 0,
  });
});

test("quality percents use committed lines, chat turns, and the commit log", () => {
  const report = summarizeLttpAiQuality({
    drafts: [
      {
        status: "committed",
        issueSlipId: 1,
        lines: [
          { commodityId: 10, status: "sure", decisionSource: "alias", events: [] },
          {
            commodityId: 11,
            status: "edited",
            decisionSource: "score",
            events: [{ source: "ai", afterJson: { status: "needs_confirm" } }],
          },
        ],
        chatTurns: [{ role: "user" }, { role: "assistant" }],
      },
      {
        status: "committed",
        issueSlipId: 2,
        lines: [
          { commodityId: 12, status: "edited", decisionSource: "llm", events: [] },
          { commodityId: 13, status: "sure", decisionSource: "alias", events: [] },
        ],
        chatTurns: [],
      },
    ],
    fillLogs: [
      {
        issueSlipId: 1,
        createdAt: "2026-10-02T00:00:00Z",
        confirmedJson: [{ verdict: "ai_correct" }, { verdict: "ai_wrong" }],
      },
      {
        issueSlipId: 2,
        createdAt: "2026-10-02T00:00:00Z",
        confirmedJson: [{ verdict: "ai_wrong" }, { verdict: "untouched" }],
      },
    ],
  });
  assert.equal(report.slips, 2);
  assert.equal(report.lines, 4);
  assert.equal(report.pctCorrectNoEdit, 25);
  assert.equal(report.pctNeedsConfirm, 25);
  assert.equal(report.pctEditedBySource.score, 25);
  assert.equal(report.pctEditedBySource.llm, 25);
  assert.equal(report.pctEditedBySource.alias, 0);
  assert.equal(report.meanChatTurns, 0.5);
  assert.equal(report.meanLlmCalls, 2);
});
