import assert from "node:assert/strict";
import test from "node:test";

import { buildIssueSlipAiChatPrompt, buildIssueSlipAiPrompt } from "./lttp-issue-slip-ai.prompt.js";

test("buildIssueSlipAiPrompt includes memory section when memoryText is present", () => {
  const { user } = buildIssueSlipAiPrompt({
    prompt: "Xuất 10kg gạo cho bếp",
    issueDate: "2026-09-26",
    catalogText: "LTTP catalog block",
    memoryText: '- prompt: "Gao"',
    historyText: "- 2026-09-25: Gao x5 (market)",
  });

  assert.match(user, /Bai hoc AI gan day:/);
  assert.match(user, /- prompt: "Gao"/);
  assert.match(user, /Mau phieu xuat gan day:/);
});

test("buildIssueSlipAiChatPrompt includes catalog preview turns and new message", () => {
  const { system, user } = buildIssueSlipAiChatPrompt({
    message: "doi dong 1 thanh gao te",
    currentPreview: {
      headerDraft: { issueDate: "2026-09-26" },
      lines: [{ commodityName: "Gao nep", quantity: 5, priceKind: "market" }],
    },
    turns: [{ role: "user", text: "xuat gao nep" }],
    catalogText: "CATALOG NGAN",
    memoryText: '- prompt: "Gao"',
  });

  assert.match(system, /JSON/i);
  assert.match(user, /CATALOG NGAN/);
  assert.match(user, /Bai hoc AI gan day:/);
  assert.match(user, /Preview hien tai:/);
  assert.match(user, /Gao nep/);
  assert.match(user, /Hoi thoai hien tai:/);
  assert.match(user, /user: xuat gao nep/);
  assert.match(user, /Tin nhan moi:/);
  assert.match(user, /doi dong 1 thanh gao te/);
});
