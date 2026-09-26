import assert from "node:assert/strict";
import test from "node:test";

import { formatMemoriesForPrompt } from "./lttp-issue-slip-ai-memory.js";

test("formatMemoriesForPrompt prefers linked rows, caps at 20, and includes prompt lines and turns", () => {
  const rows = Array.from({ length: 22 }, (_, idx) => ({
    issueSlipId: null,
    updatedAt: new Date(`2026-09-${String((idx % 9) + 1).padStart(2, "0")}T00:00:00.000Z`),
    prompt: `prompt ${idx}`,
    turns: [],
    finalPreview: {
      lines: [{ commodityName: `Hang ${idx}`, quantity: idx + 1, priceKind: "market", mapped: true }],
    },
  }));
  rows.push({
    issueSlipId: 999,
    updatedAt: new Date("2026-09-30T00:00:00.000Z"),
    prompt: "Xin doi mat hang 1 thanh Gao te loai A",
    turns: [
      { role: "user", text: "doi mat hang 1 thanh gao te loai A" },
      { role: "assistant", text: "da doi sang gao te loai A" },
    ],
    finalPreview: {
      lines: [
        { commodityName: "Gao te", quantity: 50, priceKind: "market", mapped: true },
        { commodityName: "Bo", quantity: 3, priceKind: "tgsx", mapped: false },
      ],
    },
  });

  const text = formatMemoriesForPrompt(rows);
  const lines = text.split("\n");

  assert.equal(lines.length, 20);
  assert.match(lines[0], /Xin doi mat hang 1 thanh Gao te loai A/);
  assert.match(lines[0], /Gao te x50 \(market\)/);
  assert.doesNotMatch(lines[0], /Bo x3/);
  assert.match(lines[0], /turns: user: doi mat hang 1 thanh gao te loai A/);
  assert.ok(lines.every((line) => line.startsWith("- prompt: ")));
  assert.doesNotMatch(text, /prompt 0/);
});

test("formatMemoriesForPrompt returns fallback when no rows", () => {
  assert.equal(formatMemoriesForPrompt([]), "(khong co memory)");
});
