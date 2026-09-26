import assert from "node:assert/strict";
import test from "node:test";
import { buildIssueSlipAiPrompt } from "./lttp-issue-slip-ai.prompt.js";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

test("buildIssueSlipAiPrompt system mentions JSON schema; user has prompt and catalog", () => {
  const { system, user } = buildIssueSlipAiPrompt({
    prompt: "Xuất 10kg gạo cho bếp",
    issueDate: "2026-09-26",
    catalogText: "LTTP catalog block",
    historyText: "(khong co lich su)",
  });

  assert.match(system, /JSON/i);
  assert.match(system, /header/i);
  assert.match(system, /lines/i);
  assert.match(user, /Xuất 10kg gạo cho bếp/);
  assert.match(user, /LTTP catalog block/);
  assert.match(user, /2026-09-26/);
});

test("suggestIssueSlipAi returns headerDraft, lines, warnings, meta without DB write", async () => {
  const { suggestIssueSlipAi } = await import("./lttp-issue-slip-ai.service.js");
  const result = await suggestIssueSlipAi(
    { unitId: 1, prompt: "Xuất 5 kg gạo tẻ", issueDate: "2026-09-26" },
    { unitIds: [1] },
    [1],
    { logicalUnitId: 1, storageUnitId: 1 },
    1,
    {
      configOverride: { apiKey: "test-key", provider: "openai", model: "gpt-test" },
      loadCatalog: async () => ({
        commodities: [{ id: 10, name: "Gạo tẻ", code: "GAO" }],
        catalogText: "danh muc LTTP",
      }),
      loadHistorySamples: async () => ({
        historyText: "Phieu mau",
        historySampleCount: 8,
      }),
      loadDefaultSuppliers: async () => new Map([[10, 99]]),
      getEffectivePrices: async () => ({
        items: [{ commodity: { id: 10 }, unitPrice: 12000, tgsxPrice: 11000 }],
      }),
      completeMenuJson: async () => ({
        header: { slipNote: "  ghi chú AI  " },
        lines: [{ commodityName: "Gạo tẻ", code: "GAO", quantity: 5, priceKind: "market" }],
      }),
    },
  );

  assert.equal(result.headerDraft.slipNote, "ghi chú AI");
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].mapped, true);
  assert.equal(result.lines[0].commodityId, 10);
  assert.equal(result.lines[0].lttpSupplierId, 99);
  assert.equal(result.lines[0].unitPrice, 12000);
  assert.equal(result.meta.historySampleCount, 8);
  assert.equal(result.meta.model, "gpt-test");
  assert.ok(Array.isArray(result.warnings));
});
