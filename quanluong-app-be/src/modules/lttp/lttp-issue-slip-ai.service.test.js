import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../errors/app-error.js";
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
  assert.match(system, /Mac dinh priceKind=market/);
  assert.match(user, /Xuất 10kg gạo cho bếp/);
  assert.match(user, /LTTP catalog block/);
  assert.match(user, /2026-09-26/);
});

test("buildIssueSlipAiHistoryWhere adds recipientUnitId when provided", async () => {
  const { buildIssueSlipAiHistoryWhere } = await import("./lttp-issue-slip-ai.service.js");
  assert.deepEqual(buildIssueSlipAiHistoryWhere(7, {}), { unitId: 7 });
  assert.deepEqual(buildIssueSlipAiHistoryWhere(7, { recipientUnitId: 33 }), {
    unitId: 7,
    recipientUnitId: 33,
  });
});

test("suggestIssueSlipAi returns headerDraft, lines, warnings, meta without DB write", async () => {
  const { suggestIssueSlipAi } = await import("./lttp-issue-slip-ai.service.js");
  let createdPayload = null;
  let memoryArgs = null;
  const result = await suggestIssueSlipAi(
    { unitId: 1, prompt: "Xuất 5 kg gạo tẻ", issueDate: "2026-09-26" },
    { unitIds: [1] },
    [1],
    { logicalUnitId: 1, storageUnitId: 9 },
    1,
    {
      configOverride: { apiKey: "test-key", provider: "openai", model: "gpt-test" },
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
      prismaClient: {
        lttpIssueSlipAiMemory: {
          create: async ({ data }) => {
            createdPayload = data;
            return data;
          },
        },
      },
      loadCatalog: async () => ({
        commodities: [{ id: 10, name: "Gạo tẻ", code: "GAO" }],
        catalogText: "danh muc LTTP",
      }),
      loadMemories: async (targetUnitId, args) => {
        memoryArgs = { targetUnitId, args };
        return {
        memoryText: "memory mau",
        memorySampleCount: 4,
        };
      },
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
  assert.equal(result.sessionId, "11111111-1111-4111-8111-111111111111");
  assert.equal(result.meta.historySampleCount, 8);
  assert.equal(result.meta.memorySampleCount, 4);
  assert.equal(result.meta.model, "gpt-test");
  assert.ok(Array.isArray(result.warnings));
  assert.deepEqual(memoryArgs, {
    targetUnitId: 9,
    args: { limit: 20 },
  });
  assert.deepEqual(createdPayload, {
    unitId: 9,
    sessionId: "11111111-1111-4111-8111-111111111111",
    prompt: "Xuất 5 kg gạo tẻ",
    turns: [],
    finalPreview: null,
    createdById: null,
  });
});

test("suggestIssueSlipAi does not put unvalidated body recipientUnitId in headerDraft", async () => {
  const { suggestIssueSlipAi } = await import("./lttp-issue-slip-ai.service.js");
  const result = await suggestIssueSlipAi(
    { unitId: 1, prompt: "Xuat ga", recipientUnitId: 999 },
    { unitIds: [1] },
    [1],
    { logicalUnitId: 1, storageUnitId: 1 },
    1,
    {
      configOverride: { apiKey: "test-key", provider: "openai", model: "gpt-test" },
      randomUUID: () => "22222222-2222-4222-8222-222222222222",
      prismaClient: {
        lttpIssueSlipAiMemory: {
          create: async ({ data }) => data,
        },
      },
      loadCatalog: async () => ({
        commodities: [{ id: 10, name: "Gạo tẻ", code: "GAO" }],
        catalogText: "cat",
      }),
      loadMemories: async () => ({ memoryText: "", memorySampleCount: 0 }),
      loadHistorySamples: async () => ({ historyText: "", historySampleCount: 5 }),
      loadDefaultSuppliers: async () => new Map([[10, 99]]),
      getEffectivePrices: async () => ({
        items: [{ commodity: { id: 10 }, unitPrice: 1, tgsxPrice: 1 }],
      }),
      completeMenuJson: async () => ({
        header: {},
        lines: [{ commodityName: "Gạo tẻ", quantity: 1, priceKind: "market" }],
      }),
    },
  );

  assert.equal(result.headerDraft.recipientUnitId, null);
  assert.ok(result.warnings.some((w) => w.includes("yêu cầu")));
});

test("suggestIssueSlipAi passes recipientUnitId into history loader and drops TGSX when prompt does not signal it", async () => {
  const { suggestIssueSlipAi } = await import("./lttp-issue-slip-ai.service.js");
  let historyArgs = null;
  const result = await suggestIssueSlipAi(
    {
      unitId: 1,
      prompt: "Xuất 3 kg gạo tẻ",
      recipientUnitId: 88,
      issueDate: "2026-09-26",
    },
    { unitIds: [1] },
    [1],
    { logicalUnitId: 1, storageUnitId: 1 },
    1,
    {
      configOverride: { apiKey: "test-key", provider: "openai", model: "gpt-test" },
      randomUUID: () => "33333333-3333-4333-8333-333333333333",
      prismaClient: {
        lttpIssueSlipAiMemory: {
          create: async ({ data }) => data,
        },
      },
      loadCatalog: async () => ({
        commodities: [{ id: 10, name: "Gạo tẻ", code: "GAO" }],
        catalogText: "cat",
      }),
      loadMemories: async () => ({ memoryText: "", memorySampleCount: 0 }),
      loadHistorySamples: async (storageUnitId, opts) => {
        historyArgs = { storageUnitId, opts };
        return { historyText: "history", historySampleCount: 6 };
      },
      loadDefaultSuppliers: async () => new Map([[10, 99]]),
      getEffectivePrices: async () => ({
        items: [{ commodity: { id: 10 }, unitPrice: 10, tgsxPrice: 8 }],
      }),
      completeMenuJson: async () => ({
        header: {},
        lines: [{ commodityName: "Gạo tẻ", quantity: 3, priceKind: "tgsx" }],
      }),
    },
  );

  assert.deepEqual(historyArgs, {
    storageUnitId: 1,
    opts: { recipientUnitId: 88 },
  });
  assert.equal(result.lines.length, 0);
  assert.ok(result.warnings.some((w) => /TGSX/i.test(w)));
});

test("chatIssueSlipAi appends user and assistant turns and returns sessionId", async () => {
  const { chatIssueSlipAi } = await import("./lttp-issue-slip-ai.service.js");
  const memory = {
    sessionId: "44444444-4444-4444-8444-444444444444",
    unitId: 9,
    prompt: "Xuat gao",
    turns: [{ role: "user", text: "turn cu" }],
  };
  let updatedPayload = null;
  let memoryArgs = null;
  let effectivePriceArgs = null;

  const result = await chatIssueSlipAi(
    {
      sessionId: memory.sessionId,
      unitId: 1,
      message: "doi thanh gao nep",
      currentPreview: { headerDraft: { slipNote: "cu", issueDate: "2026-10-03" }, lines: [] },
    },
    { unitIds: [1] },
    [1],
    { logicalUnitId: 1, storageUnitId: 9 },
    1,
    {
      configOverride: { apiKey: "test-key", provider: "openai", model: "gpt-test" },
      prismaClient: {
        lttpIssueSlipAiMemory: {
          findUnique: async () => memory,
          update: async ({ data }) => {
            updatedPayload = data;
            return { ...memory, ...data };
          },
        },
      },
      loadCatalog: async () => ({
        commodities: [{ id: 10, name: "Gạo nếp", code: "GNEP" }],
        catalogText: "cat",
      }),
      loadMemories: async (targetUnitId, args) => {
        memoryArgs = { targetUnitId, args };
        return { memoryText: "memory", memorySampleCount: 2 };
      },
      loadDefaultSuppliers: async () => new Map([[10, 99]]),
      getEffectivePrices: async (args) => {
        effectivePriceArgs = args;
        return {
          items: [{ commodity: { id: 10 }, unitPrice: 12, tgsxPrice: 9 }],
        };
      },
      completeMenuJson: async () => ({
        header: { slipNote: "  da doi  " },
        lines: [{ commodityName: "Gạo nếp", quantity: 1, priceKind: "market" }],
      }),
      now: () => new Date("2026-09-26T05:00:00.000Z"),
    },
  );

  assert.equal(result.sessionId, memory.sessionId);
  assert.equal(result.headerDraft.slipNote, "da doi");
  assert.equal(result.lines.length, 1);
  assert.equal(updatedPayload.turns.length, 3);
  assert.deepEqual(memoryArgs, {
    targetUnitId: 9,
    args: { limit: 20 },
  });
  assert.deepEqual(effectivePriceArgs, { unitId: 1, date: "2026-10-03" });
  assert.deepEqual(updatedPayload.turns[1], {
    role: "user",
    text: "doi thanh gao nep",
    at: "2026-09-26T05:00:00.000Z",
  });
  assert.equal(updatedPayload.turns[2].role, "assistant");
  assert.match(updatedPayload.turns[2].text, /Gạo nếp/);
  assert.equal(updatedPayload.turns[2].at, "2026-09-26T05:00:00.000Z");
});

test("chatIssueSlipAi rejects when session already has 20 turns", async () => {
  const { chatIssueSlipAi } = await import("./lttp-issue-slip-ai.service.js");
  const turns = Array.from({ length: 20 }, (_, i) => ({ role: "user", text: `turn ${i}` }));

  await assert.rejects(
    () =>
      chatIssueSlipAi(
        {
          sessionId: "55555555-5555-4555-8555-555555555555",
          unitId: 1,
          message: "them nua",
        },
        { unitIds: [1] },
        [1],
        { logicalUnitId: 1, storageUnitId: 1 },
        1,
        {
          configOverride: { apiKey: "test-key", provider: "openai", model: "gpt-test" },
          prismaClient: {
            lttpIssueSlipAiMemory: {
              findUnique: async () => ({
                sessionId: "55555555-5555-4555-8555-555555555555",
                unitId: 1,
                prompt: "Xuat gao",
                turns,
              }),
            },
          },
        },
      ),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /20/);
      return true;
    },
  );
});

test("commitIssueSlipAiMemory sets finalPreview for the session", async () => {
  const { commitIssueSlipAiMemory } = await import("./lttp-issue-slip-ai.service.js");
  let updatedArgs = null;
  const finalPreview = {
    headerDraft: { issueDate: "2026-09-26" },
    lines: [{ commodityId: 10, quantity: 2 }],
  };

  await commitIssueSlipAiMemory(
    {
      sessionId: "66666666-6666-4666-8666-666666666666",
      unitId: 1,
      finalPreview,
      userId: 7,
    },
    { unitIds: [1] },
    [1],
    { logicalUnitId: 1, storageUnitId: 9 },
    1,
    {
      prismaClient: {
        lttpIssueSlipAiMemory: {
          updateMany: async (args) => {
            updatedArgs = args;
            return { count: 1 };
          },
        },
      },
    },
  );

  assert.deepEqual(updatedArgs, {
    where: {
      sessionId: "66666666-6666-4666-8666-666666666666",
      unitId: 9,
    },
    data: {
      finalPreview,
      updatedById: 7,
    },
  });
});

test("linkIssueSlipAiMemory links issueSlipId only when session belongs to unit", async () => {
  const { linkIssueSlipAiMemory } = await import("./lttp-issue-slip-ai.service.js");
  let updatedArgs = null;

  await linkIssueSlipAiMemory(
    {
      sessionId: "77777777-7777-4777-8777-777777777777",
      unitId: 1,
      issueSlipId: 123,
      userId: 9,
    },
    { unitIds: [1] },
    [1],
    { logicalUnitId: 1, storageUnitId: 9 },
    1,
    {
      prismaClient: {
        lttpIssueSlipAiMemory: {
          findUnique: async () => ({
            sessionId: "77777777-7777-4777-8777-777777777777",
            unitId: 9,
          }),
          update: async (args) => {
            updatedArgs = args;
            return args.data;
          },
        },
        lttpIssueSlip: {
          findUnique: async () => ({ id: 123, unitId: 9 }),
        },
      },
    },
  );

  assert.deepEqual(updatedArgs, {
    where: { sessionId: "77777777-7777-4777-8777-777777777777" },
    data: {
      issueSlipId: 123,
      updatedById: 9,
    },
  });
});
