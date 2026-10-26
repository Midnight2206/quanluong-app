import assert from "node:assert/strict";
import test from "node:test";
process.env.DATABASE_URL ||= "mysql://local:local@127.0.0.1:3306/quanluong";
process.env.JWT_ACCESS_SECRET ||= "test-secret-test-secret-test-secret";
process.env.SESSION_SECRET ||= "test-session-test-session-test-session";

const { applyDraft, getAssistant, postTurn } = await import("./kitchen-ledger-assistant.service.js");

const scope = { mode: "all" };
const dataScope = { storageUnitId: 3, logicalUnitId: 7 };
const user = { id: 4, type: { name: "cook" }, fullName: "Tran Thi B" };
const off = { apiKey: "", provider: "openai", model: "gpt-test", baseUrl: "https://example.test/v1", timeoutMs: 5000 };
const on = { ...off, apiKey: "secret-key" };

function createDb() {
  const state = { profile: [], memory: [], rule: [], conversation: [], message: [], usage: [] };
  let seq = 1;
  const nextId = () => seq++;
  return {
    state,
    kitchenLedgerSettings: { findUnique: async () => null },
    ledgerAssistantProfile: {
      upsert: async ({ where, create, update }) => {
        const key = where.userId_unitId;
        let row = state.profile.find((item) => item.userId === key.userId && item.unitId === key.unitId);
        if (!row) {
          row = { ...create };
          state.profile.push(row);
        } else if (update && Object.keys(update).length) Object.assign(row, update);
        return { ...row };
      },
    },
    ledgerAssistantMemory: {
      findMany: async () => state.memory.map((row) => ({ ...row })),
      count: async ({ where }) => state.memory.filter((row) => row.userId === where.userId && row.unitId === where.unitId).length,
      create: async ({ data }) => {
        const row = { id: nextId(), createdAt: new Date(), ...data };
        state.memory.push(row);
        return row;
      },
      deleteMany: async ({ where }) => {
        const before = state.memory.length;
        state.memory = state.memory.filter((row) => !(row.id === where.id && row.userId === where.userId && row.unitId === where.unitId));
        return { count: before - state.memory.length };
      },
    },
    ledgerAssistantRuleNote: {
      findMany: async () => state.rule.map((row) => ({ ...row })),
      create: async ({ data }) => {
        const row = { id: nextId(), createdAt: new Date(), ...data };
        state.rule.push(row);
        return row;
      },
      deleteMany: async ({ where }) => {
        const before = state.rule.length;
        state.rule = state.rule.filter((row) => !(row.id === where.id && row.userId === where.userId && row.unitId === where.unitId));
        return { count: before - state.rule.length };
      },
    },
    ledgerAssistantConversation: {
      findFirst: async ({ where }) => state.conversation.find((row) => row.userId === where.userId && row.unitId === where.unitId) || null,
      create: async ({ data }) => {
        const row = { id: nextId(), createdAt: new Date(), updatedAt: new Date(), ...data };
        state.conversation.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = state.conversation.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    ledgerAssistantMessage: {
      findMany: async ({ where }) => state.message.filter((row) => row.conversationId === where.conversationId).map((row) => ({ ...row })),
      create: async ({ data }) => {
        const row = { id: nextId(), createdAt: new Date(), ...data };
        state.message.push(row);
        return { ...row };
      },
      findFirst: async ({ where }) => state.message.find((row) => {
        if (row.id !== where.id) return false;
        const conversation = state.conversation.find((item) => item.id === row.conversationId);
        return conversation?.userId === where.conversation.userId && conversation?.unitId === where.conversation.unitId;
      }) || null,
      update: async ({ where, data }) => {
        const row = state.message.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    ledgerAssistantUsage: {
      create: async ({ data }) => {
        state.usage.push({ ...data });
        return data;
      },
    },
  };
}

function ctx(db, extra = {}) {
  return {
    prisma: db,
    configOverride: extra.configOverride || off,
    extractStructured: extra.extractStructured,
    getLedger: extra.getLedger,
    saveLedger: extra.saveLedger,
    saveLedgerSettings: extra.saveLedgerSettings,
    loadCommodities: extra.loadCommodities,
    fetchImpl: extra.fetchImpl,
    dshFetch: extra.dshFetch,
    surface: extra.surface,
    engine: extra.engine,
    dshServiceUrl: extra.dshServiceUrl,
    dshServiceToken: extra.dshServiceToken,
  };
}

function assertUsagePrivate(db, secret) {
  const allowed = ["feature", "inputBytes", "inputSha256", "model", "provider", "status", "unitId", "userId"];
  for (const row of db.state.usage) {
    assert.deepEqual(Object.keys(row).sort(), allowed);
    const packed = JSON.stringify(row);
    assert.equal(packed.includes("Tran Thi B"), false);
    assert.equal(packed.includes(secret), false);
    assert.equal(packed.includes("secret-key"), false);
  }
}

test("superadmin không đọc nội dung trợ lý", async () => {
  let touched = false;
  const prisma = new Proxy({}, { get() { touched = true; return () => null; } });
  await assert.rejects(
    () => getAssistant(
      { unitId: 7, date: "2026-10-21" },
      { id: 1, type: { name: "superadmin" } },
      scope,
      null,
      dataScope,
      { prisma },
    ),
    (err) => err.statusCode === 403,
  );
  assert.equal(touched, false);
});

test("quân số nhiều ngày, sửa rồi ghi, thống kê không chứa nội dung", async () => {
  const db = createDb();
  db.state.memory.push({ id: 9, userId: 4, unitId: 7, fact: "Bếp thích nhập tay buổi sáng", createdAt: new Date() });
  const text = "18/10: 91 97 97 · 0 0 0\n19/10: 91 120 100 · 0 0 0";
  const image = "aGk=";
  let prompt;
  const saved = [];
  const posted = await postTurn({
    unitId: 7,
    date: "2026-10-21",
    text,
    imageBase64: image,
    imageMime: "image/jpeg",
    intent: "headcount",
  }, user, scope, null, dataScope, ctx(db, {
    configOverride: on,
    extractStructured: async (value) => {
      prompt = value;
      return {
        data: {
          records: [
            {
              type: "headcount",
              date: "18/10",
              levels: [
                { dailyAmount: 72000, sang: 91, trua: 97, chieu: 97 },
                { dailyAmount: 130000, sang: 0, trua: 0, chieu: 0 },
              ],
              extras: { benhXa: 0, benhNhan: 0, omTrai: 0, leTet: 0 },
              confidence: 0.95,
              source: "18/10: 91 97 97",
            },
            {
              type: "headcount",
              date: "19/10",
              levels: [
                { dailyAmount: 72000, sang: 91, trua: 120, chieu: 100 },
                { dailyAmount: 130000, sang: 0, trua: 0, chieu: 0 },
              ],
              extras: { benhXa: 0, benhNhan: 0, omTrai: 0, leTet: 0 },
              confidence: 0.4,
              source: "19/10: 91 120 100",
            },
          ],
        },
        model: "gpt-test",
        provider: "openai",
      };
    },
    saveLedger: async (body) => { saved.push(body); return { ok: true }; },
  }));
  assert.equal(prompt.temperature, 0);
  assert.equal(prompt.system.includes("Tran Thi B"), false);
  assert.match(prompt.system, /Bếp thích nhập tay/);
  assert.equal(prompt.image.base64, image);
  assert.equal(JSON.stringify(db.state.message).includes(image), false);
  assert.equal(posted.message.kind, "headcount_draft");
  assert.equal(posted.message.payloadJson.days[1].confidence.levels[0].trua, 0.4);
  assertUsagePrivate(db, image);
  assert.equal(db.state.usage[0].status, "ok");
  assert.equal(db.state.usage[0].feature, "kitchen-ledger-headcount");
  const applied = await applyDraft({
    unitId: 7,
    messageId: posted.message.id,
    headcountDays: [{
      date: "2026-10-18",
      headcount: {
        levels: [
          { dailyAmount: 72000, sang: 90, trua: 97, chieu: 97 },
          { dailyAmount: 130000, sang: 0, trua: 0, chieu: 0 },
        ],
        extras: { benhXa: 0, benhNhan: 0, omTrai: 0, leTet: 0 },
      },
    }],
  }, user, scope, null, dataScope, ctx(db, {
    saveLedger: async (body) => { saved.push(body); return { ok: true }; },
  }));
  assert.equal(saved[0].date, "2026-10-18");
  assert.equal(saved[0].headcount.levels[0].sang, 90);
  assert.equal(saved[0].selfSupply, undefined);
  assert.deepEqual(applied.changes, [{ date: "2026-10-18", field: "72000.sang", from: 91, to: 90 }]);
  await assert.rejects(
    () => applyDraft({ unitId: 7, messageId: posted.message.id, headcountDays: [] }, { ...user, id: 5 }, scope, null, dataScope, ctx(db)),
    (err) => err.statusCode === 404,
  );
});

test("AI hỏng hoặc tắt thì không ghi sổ và không lưu ảnh", async () => {
  const db = createDb();
  await assert.rejects(
    () => postTurn({
      unitId: 7,
      date: "2026-10-21",
      text: "18/10: 91 97 97 · 0 0 0",
      intent: "headcount",
    }, user, scope, null, dataScope, ctx(db, {
      extractStructured: async () => ({ data: { days: [{ date: "abc" }] }, model: "gpt-test", provider: "openai" }),
      configOverride: on,
    })),
    (err) => err.statusCode === 502,
  );
  assert.equal(db.state.usage[0].status, "error");
  assertUsagePrivate(db, "91 97 97");
  const offDb = createDb();
  await assert.rejects(
    () => postTurn({
      unitId: 7, date: "2026-10-21", text: "18/10: 1 1 1 · 0 0 0", intent: "headcount",
    }, user, scope, null, dataScope, ctx(offDb)),
    (err) => err.statusCode === 503,
  );
  assert.equal(offDb.state.usage.length, 0);
});

test("như 17/10 lấy quân số trên sổ, không gọi AI", async () => {
  const db = createDb();
  let asked;
  const posted = await postTurn({
    unitId: 7, date: "2026-10-21", text: "như 17/10",
  }, user, scope, null, dataScope, ctx(db, {
    getLedger: async (query) => {
      asked = query.date;
      return {
        headcountSaved: true,
        headcount: {
          levels: [
            { code: "72", dailyAmount: 72000, sang: 93, trua: 99, chieu: 99 },
            { code: "130", dailyAmount: 130000, sang: 0, trua: 0, chieu: 0 },
          ],
          extras: { benhXa: 0, benhNhan: 0, omTrai: 0, leTet: 0 },
        },
      };
    },
  }));
  assert.equal(asked, "2026-10-17");
  assert.equal(posted.message.payloadJson.days[0].date, "2026-10-21");
  assert.equal(posted.message.payloadJson.days[0].headcount.levels[0].sang, 93);
  assert.equal(db.state.usage.length, 0);
});

test("câu hàng ghi thêm vào dòng sẵn có", async () => {
  const db = createDb();
  const saved = [];
  let prompt;
  const posted = await postTurn({
    unitId: 7,
    date: "2026-10-24",
    text: "mua ngoài 5kg mực 180k, sữa 40 hộp",
    intent: "movement",
  }, user, scope, null, dataScope, ctx(db, {
    configOverride: on,
    loadCommodities: async () => [
      { id: 1, name: "Mực ống", measureUnit: "Kg" },
      { id: 2, name: "Sữa đặc", measureUnit: "Hộp" },
      { id: 3, name: "Sữa tươi", measureUnit: "Hộp" },
    ],
    extractStructured: async (value) => {
      prompt = value;
      return {
        data: { records: [
          { type: "outside_purchase", date: "2026-10-24", name: "mực", qty: 5, uom: "kg", unitPrice: "180k", confidence: 0.92, source: "mua ngoài 5kg mực 180k", column: "G" },
          { type: "outside_purchase", date: "2026-10-24", name: "sữa", qty: 40, uom: "hộp", confidence: 0.4, source: "sữa 40 hộp" },
        ] },
        model: "gpt-test",
        provider: "openai",
      };
    },
  }));
  assert.equal(/cột|cot [GHIJP]\b/i.test(prompt.system), false);
  assert.equal(posted.message.payloadJson.lines[0].savable, true);
  assert.equal(posted.message.payloadJson.lines[0].source, "I");
  assert.equal(posted.message.payloadJson.lines[0].place, "Đơn vị BĐ mua TT");
  assert.equal(posted.message.payloadJson.lines[1].savable, false);
  await applyDraft({
    unitId: 7,
    messageId: posted.message.id,
    movementLines: [{ name: "Mực ống", qty: 6, unitPrice: 180000 }],
  }, user, scope, null, dataScope, ctx(db, {
    getLedger: async () => ({
      movements: [{ kind: "self_supply", source: "I", commodityId: 8, itemName: "Trứng", qty: "10", issuePolicy: "today" }],
    }),
    saveLedger: async (body) => { saved.push(body); return { date: body.date }; },
  }));
  assert.equal(saved[0].selfSupply.lines.length, 2);
  assert.equal(saved[0].selfSupply.lines[0].commodityId, 8);
  assert.equal(saved[0].selfSupply.lines[1].commodityId, 1);
  assert.equal(saved[0].selfSupply.lines[1].qty, 6);
  assert.equal(saved[0].selfSupply.lines[1].source, "I");
  assert.equal(saved[0].rice, undefined);
  assertUsagePrivate(db, "mua ngoài 5kg mực");
});

test("hỏi thừa thiếu đọc sổ đúng ngày và không gọi mô hình", async () => {
  const db = createDb();
  let asked;
  const posted = await postTurn({
    unitId: 7,
    date: "2026-10-21",
    text: "tại sao ngày 24 thừa 9.260",
  }, user, scope, null, dataScope, ctx(db, {
    configOverride: on,
    getLedger: async (query) => {
      asked = query.date;
      return {
        date: query.date,
        ledgerBlocked: false,
        lines: [],
        finance: {
          totalIncome: "10000000",
          spent: "9990740",
          spentBasis: "total_out",
          prevSurplus: "0",
          prevShortfall: "0",
          surplus: "9260",
          shortfall: "0",
        },
      };
    },
  }));
  assert.equal(asked, "2026-10-24");
  assert.match(posted.message.content, /9\.260/);
  assert.equal(posted.message.payloadJson.tool, "explain_finance");
  assert.equal(db.state.usage.length, 0);
});

test("câu chưa nhận ra thì AI chỉ chọn công cụ, số lấy từ sổ", async () => {
  const db = createDb();
  const posted = await postTurn({
    unitId: 7,
    date: "2026-10-21",
    text: "giải thích giúp khối tiền",
  }, user, scope, null, dataScope, ctx(db, {
    configOverride: on,
    extractStructured: async () => ({
      data: {
        records: [{ type: "question", topic: "finance", confidence: 0.9, source: "khối tiền", surplus: 1 }],
      },
      model: "gpt-test",
      provider: "openai",
    }),
    getLedger: async () => ({
      date: "2026-10-21",
      ledgerBlocked: false,
      lines: [],
      finance: {
        totalIncome: "100",
        spent: "50",
        spentBasis: "meal_out",
        prevSurplus: "0",
        prevShortfall: "0",
        surplus: "9260",
        shortfall: "0",
      },
    }),
  }));
  assert.match(posted.message.content, /9\.260/);
  assert.match(posted.message.content, /xuất ăn/);
  assert.equal(posted.message.content.includes("surplus"), false);
  assert.equal(db.state.usage[0].feature, "kitchen-ledger-question");
  assertUsagePrivate(db, "giải thích giúp khối tiền");
});

test("câu hỏi không nhận dòng hàng dù mô hình trả bản ghi nhập", async () => {
  const db = createDb();
  const posted = await postTurn({
    unitId: 7,
    date: "2026-10-21",
    text: "giải thích giúp khối tiền",
  }, user, scope, null, dataScope, ctx(db, {
    configOverride: on,
    extractStructured: async () => ({
      data: {
        records: [{
          type: "outside_purchase",
          date: "2026-10-21",
          name: "mực",
          qty: 5,
          confidence: 0.9,
          source: "mua mực",
        }],
      },
      model: "gpt-test",
      provider: "openai",
    }),
    getLedger: async () => ({ date: "2026-10-21", ledgerBlocked: false, lines: [], finance: null }),
  }));
  assert.equal(posted.message.kind, "answer");
  assert.match(posted.message.content, /Hỏi cụ thể hơn/);
  assert.equal(posted.message.payloadJson, null);
});

test("quy tắc lưu ghi chú và chỉ áp dụng đúng đề nghị đã lưu", async () => {
  const db = createDb();
  const posted = await postTurn({
    unitId: 7,
    date: "2026-10-21",
    text: "Từ nay ngưỡng thừa thiếu 10.000. Cộng xuất ΣS. Lễ tết chỉ trưa.",
    ruleTitle: "Quy tắc bếp",
  }, user, scope, null, dataScope, ctx(db));
  assert.equal(db.state.rule[0].title, "Quy tắc bếp");
  assert.equal(db.state.usage.length, 0);
  let patch;
  await applyDraft({
    unitId: 7,
    messageId: posted.message.id,
    acceptProposals: true,
  }, user, scope, null, dataScope, ctx(db, {
    saveLedgerSettings: async (body) => { patch = body; return { settings: body }; },
  }));
  assert.equal(patch.balanceWarnThreshold, 10000);
  assert.equal(patch.spentBasis, "total_out");
  assert.equal(patch.holidayLunchOnly, true);
  assert.equal(patch.unitId, 7);
});

test("cân đối không tự ghi sổ", async () => {
  const db = createDb();
  let saved = false;
  const posted = await postTurn({
    unitId: 7, date: "2026-10-21", text: "cân đối âm kho giúp",
  }, user, scope, null, dataScope, ctx(db, {
    saveLedger: async () => { saved = true; },
  }));
  assert.match(posted.message.content, /nút Cân đối/);
  assert.equal(saved, false);
});

test("AI tắt vẫn trả lời khi câu hỏi chọn được công cụ", async () => {
  const state = await getAssistant({ unitId: 7, date: "2026-10-21" }, user, scope, null, dataScope, ctx(createDb(), {
    getLedger: async () => ({ blockers: [{ code: "missing_slip", message: "Thiếu phiếu xuất." }], warnings: [], finance: null }),
  }));
  assert.equal(state.enabled, false);
  assert.equal(state.profile.displayName, "Trợ lý làm sổ");
  assert.match(state.brief[0].message, /phiếu/);
});

function noteJson() {
  return JSON.stringify({
    records: [{ type: "note", text: "khong co hang", confidence: 0.9, source: "mua" }],
  });
}

test("trợ lý sổ đi qua DSH và không gọi OpenRouter trực tiếp", async () => {
  let direct = 0;
  const db = createDb();
  const posted = await postTurn({
    unitId: 7,
    date: "2026-10-21",
    text: "mua 2 kg gao",
    intent: "movement",
  }, user, scope, null, dataScope, ctx(db, {
      configOverride: on,
      engine: "dsh",
      dshServiceUrl: "http://dsh.test",
      dshServiceToken: "token",
      loadCommodities: async () => [],
      fetchImpl: async () => {
        direct += 1;
        throw new Error("direct path should not run");
      },
      dshFetch: async (url) => {
        if (String(url).endsWith("/v1/sessions")) {
          return { ok: true, status: 201, json: async () => ({ id: "session-acct-4-unit-7-web" }) };
        }
        return { ok: true, status: 200, json: async () => ({ content: noteJson(), model: "google/gemini-3.8-flash" }) };
      },
    }));
  assert.equal(direct, 0);
  assert.equal(posted.message.kind, "note");
  assert.match(posted.message.content, /khong co hang/);
  assert.equal(db.state.usage.at(-1).provider, "dsh");
});

test("trợ lý sổ dùng đường trực tiếp khi DSH không chạy", async () => {
  let direct = 0;
  const db = createDb();
  const posted = await postTurn({
    unitId: 7,
    date: "2026-10-21",
    text: "mua 2 kg gao",
    intent: "movement",
  }, user, scope, null, dataScope, ctx(db, {
    configOverride: on,
    engine: "dsh",
    dshServiceUrl: "http://dsh.test",
    dshServiceToken: "token",
    loadCommodities: async () => [],
    dshFetch: async () => {
      throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    },
    fetchImpl: async () => {
      direct += 1;
      return { ok: true, json: async () => ({ choices: [{ message: { content: noteJson() } }] }) };
    },
  }));
  assert.equal(direct, 1);
  assert.equal(posted.message.kind, "note");
  assert.equal(db.state.usage.at(-1).provider, "openai");
});
