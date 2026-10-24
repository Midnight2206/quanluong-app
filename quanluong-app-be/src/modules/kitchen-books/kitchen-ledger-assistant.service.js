import { createHash } from "node:crypto";
import { prisma as defaultPrisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { extractStructured, readMenuAiFromEnv } from "./kitchen-books-menu-ai-llm.js";
import {
  assertKitchenLogicalMatchesDataScope,
  assertKitchenWriteUnit,
} from "./kitchen-books-scope.helpers.js";
import { getLedger, saveLedger, saveLedgerSettings } from "./kitchen-ledger.service.js";
import { mergeLedgerSettings, normalizeName } from "./kitchen-ledger-settings.js";
import {
  buildHeadcountPrompt,
  diffHeadcount,
  normalizeAiHeadcount,
} from "./kitchen-ledger-ai-headcount.js";
import {
  briefAnomalies,
  fold,
  headcountLike,
  normalizeMovementDraft,
  proposeSettings,
  questionDate,
  renderTool,
  routeIntent,
  routeQuestion,
  settingsPatch,
  toolSchema,
} from "./kitchen-ledger-assistant-core.js";

const MAX_IMAGE_BYTES = 4_000_000;
const MEMORY_CAP = 30;
const RULE_CAP = 20;
const MESSAGE_CAP = 40;

function fail(message, statusCode, code = ERROR_CODES.VALIDATION_ERROR) {
  return new AppError({ message, statusCode, code });
}

function assertOwner(user) {
  if (user?.type?.name === "superadmin") {
    throw fail(
      "Superadmin chỉ xem thống kê sử dụng, không đọc nội dung trợ lý.",
      403,
      ERROR_CODES.FORBIDDEN,
    );
  }
  if (!user?.id) throw fail("Thiếu tài khoản.", 401, ERROR_CODES.UNAUTHORIZED);
}

function assertScope(unitId, scope, effectiveUnitIds, dataScope) {
  assertKitchenWriteUnit(unitId, scope, effectiveUnitIds);
  assertKitchenLogicalMatchesDataScope(unitId, dataScope);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function aiConfig(opts) {
  return opts.configOverride || readMenuAiFromEnv();
}

function imageOf(payload) {
  if (!payload.imageBase64) return null;
  let b64 = String(payload.imageBase64).trim();
  const dataUrl = /^data:[^;]+;base64,([\s\S]+)$/.exec(b64);
  if (dataUrl) b64 = dataUrl[1];
  b64 = b64.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) throw fail("Ảnh không đọc được.", 400);
  const bytes = Buffer.from(b64, "base64").length;
  if (!bytes || bytes > MAX_IMAGE_BYTES) throw fail("Ảnh lớn hơn 4 MB.", 400);
  return { mime: payload.imageMime, base64: b64, bytes };
}

async function loadSettings(db, unitId) {
  const row = await db.kitchenLedgerSettings.findUnique({ where: { unitId } });
  return mergeLedgerSettings(row?.configJson);
}

async function conversationOf(db, userId, unitId) {
  const existing = await db.ledgerAssistantConversation.findFirst({
    where: { userId, unitId },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;
  return db.ledgerAssistantConversation.create({ data: { userId, unitId } });
}

async function addMessage(db, conversationId, message) {
  const row = await db.ledgerAssistantMessage.create({
    data: { conversationId, ...message },
  });
  await db.ledgerAssistantConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
  return row;
}

async function writeUsage(db, row) {
  await db.ledgerAssistantUsage.create({ data: row }).catch(() => null);
}

function usageRow(userId, unitId, feature, cfg, inputSha, inputBytes, status) {
  return {
    userId,
    unitId,
    feature,
    provider: cfg.provider || "openai",
    model: cfg.model || "unknown",
    inputSha256: inputSha,
    inputBytes,
    status,
  };
}

async function profileOf(db, userId, unitId) {
  return db.ledgerAssistantProfile.upsert({
    where: { userId_unitId: { userId, unitId } },
    create: {
      userId,
      unitId,
      displayName: "Trợ lý làm sổ",
      tone: "ngan_gon",
      preferences: {},
    },
    update: {},
  });
}

function toneLine(tone) {
  return tone === "than_mat"
    ? "Giong ngan, xung minh. Khong ke ten nguoi."
    : "Tra loi ngan. Khong ke ten nguoi.";
}

async function memoryLines(db, userId, unitId) {
  const rows = await db.ledgerAssistantMemory.findMany({
    where: { userId, unitId },
    orderBy: { createdAt: "desc" },
    take: MEMORY_CAP,
  });
  return rows.map((row) => row.fact);
}

function ownedMessage(db, messageId, userId, unitId) {
  return db.ledgerAssistantMessage.findFirst({
    where: { id: messageId, conversation: { userId, unitId } },
  });
}

async function getAssistant(query, user, scope, effectiveUnitIds, dataScope, opts = {}) {
  assertOwner(user);
  const unitId = Number(query.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const db = opts.prisma ?? defaultPrisma;
  const profile = await profileOf(db, user.id, unitId);
  const memory = await db.ledgerAssistantMemory.findMany({
    where: { userId: user.id, unitId },
    orderBy: { createdAt: "desc" },
    take: MEMORY_CAP,
  });
  const rules = await db.ledgerAssistantRuleNote.findMany({
    where: { userId: user.id, unitId },
    orderBy: { createdAt: "desc" },
    take: RULE_CAP,
  });
  const conversation = await db.ledgerAssistantConversation.findFirst({
    where: { userId: user.id, unitId },
    orderBy: { updatedAt: "desc" },
  });
  const messages = conversation
    ? (await db.ledgerAssistantMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: MESSAGE_CAP,
    })).reverse()
    : [];
  const readLedger = opts.getLedger ?? getLedger;
  let brief = [];
  try {
    const view = await readLedger(query, scope, effectiveUnitIds, dataScope);
    brief = briefAnomalies(view);
  } catch (err) {
    brief = [{ code: "ledger", message: err?.message || "Chưa đọc được sổ." }];
  }
  return {
    enabled: Boolean(aiConfig(opts).apiKey),
    profile: {
      displayName: profile.displayName,
      tone: profile.tone,
      preferences: profile.preferences || {},
    },
    memory: memory.map((row) => ({ id: row.id, fact: row.fact })),
    rules: rules.map((row) => ({ id: row.id, title: row.title, body: row.body, createdAt: row.createdAt })),
    messages: messages.map((row) => ({
      id: row.id,
      role: row.role,
      kind: row.kind,
      content: row.content,
      payloadJson: row.payloadJson,
      createdAt: row.createdAt,
    })),
    brief,
  };
}

async function saveProfile(payload, user, scope, effectiveUnitIds, dataScope, opts = {}) {
  assertOwner(user);
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const db = opts.prisma ?? defaultPrisma;
  const preferences = {
    ...(payload.preferences?.preferredInput ? { preferredInput: payload.preferences.preferredInput } : {}),
    ...(payload.preferences?.suggestThreshold != null
      ? { suggestThreshold: payload.preferences.suggestThreshold }
      : {}),
  };
  const row = await db.ledgerAssistantProfile.upsert({
    where: { userId_unitId: { userId: user.id, unitId } },
    create: {
      userId: user.id,
      unitId,
      displayName: payload.displayName,
      tone: payload.tone,
      preferences,
    },
    update: { displayName: payload.displayName, tone: payload.tone, preferences },
  });
  return { displayName: row.displayName, tone: row.tone, preferences: row.preferences || {} };
}

async function addMemory(payload, user, scope, effectiveUnitIds, dataScope, opts = {}) {
  assertOwner(user);
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const db = opts.prisma ?? defaultPrisma;
  const count = await db.ledgerAssistantMemory.count({ where: { userId: user.id, unitId } });
  if (count >= MEMORY_CAP) throw fail("Đã đủ 30 ghi nhớ. Xóa bớt trước khi thêm.", 400);
  const row = await db.ledgerAssistantMemory.create({
    data: { userId: user.id, unitId, fact: payload.fact.trim() },
  });
  return { id: row.id, fact: row.fact };
}

async function deleteOwned(db, model, id, userId, unitId, missing) {
  const result = await db[model].deleteMany({ where: { id, userId, unitId } });
  if (!result.count) throw fail(missing, 404, ERROR_CODES.NOT_FOUND);
  return { id };
}

async function removeMemory(payload, user, scope, effectiveUnitIds, dataScope, opts = {}) {
  assertOwner(user);
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const db = opts.prisma ?? defaultPrisma;
  return deleteOwned(db, "ledgerAssistantMemory", Number(payload.id), user.id, unitId, "Không thấy ghi nhớ.");
}

async function removeRule(payload, user, scope, effectiveUnitIds, dataScope, opts = {}) {
  assertOwner(user);
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const db = opts.prisma ?? defaultPrisma;
  return deleteOwned(db, "ledgerAssistantRuleNote", Number(payload.id), user.id, unitId, "Không thấy quy tắc.");
}

async function postTurn(payload, user, scope, effectiveUnitIds, dataScope, opts = {}) {
  assertOwner(user);
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const db = opts.prisma ?? defaultPrisma;
  const text = String(payload.text ?? "").trim();
  const image = imageOf(payload);
  if (!text && !image) throw fail("Nhập nội dung hoặc chọn ảnh.", 400);
  const intent = payload.intent || routeIntent(text, Boolean(image));
  const conversation = await conversationOf(db, user.id, unitId);
  await addMessage(db, conversation.id, {
    role: "user",
    kind: "user",
    content: text || "Ảnh quân số",
    payloadJson: { intent, hadImage: Boolean(image), imageBytes: image?.bytes || 0 },
  });
  const ctx = { db, user, unitId, text, image, intent, payload, scope, effectiveUnitIds, dataScope, opts, conversation };
  if (!payload.intent && /can doi/.test(fold(text)) && intent === "question") {
    return reply(ctx, "note", "Cân đối tồn âm chỉ chạy khi bấm nút Cân đối và xác nhận. Trợ lý không tự ghi dòng cân đối.");
  }
  if (intent === "rule") return turnRule(ctx);
  if (intent === "headcount") return turnHeadcount(ctx);
  if (intent === "movement") return turnMovement(ctx);
  return turnQuestion(ctx);
}

async function reply(ctx, kind, content, payloadJson = null) {
  const row = await addMessage(ctx.db, ctx.conversation.id, {
    role: "assistant",
    kind,
    content,
    payloadJson,
  });
  return {
    message: {
      id: row.id,
      role: row.role,
      kind: row.kind,
      content: row.content,
      payloadJson: row.payloadJson,
    },
  };
}

async function callExtract(ctx, feature, prompt, { soft = false } = {}) {
  const cfg = aiConfig(ctx.opts);
  const extract = ctx.opts.extractStructured ?? extractStructured;
  const inputSha = sha256(`${ctx.text}\n${ctx.image?.base64 || ""}`);
  const inputBytes = Buffer.byteLength(ctx.text) + (ctx.image?.bytes || 0);
  const meta = { inputSha, inputBytes, feature };
  try {
    const extracted = await extract(prompt, {
      configOverride: ctx.opts.configOverride,
      fetchImpl: ctx.opts.fetchImpl,
      disabledMessage: "AI đang tắt (chưa có MENU_AI_API_KEY). Nhập tay ở bảng phía trên.",
      retryUserHint: "Tra ve dung JSON. Khong ten nguoi.",
    });
    return { extracted, ...meta };
  } catch (err) {
    if (err?.statusCode !== 503) {
      await writeUsage(ctx.db, usageRow(ctx.user.id, ctx.unitId, feature, cfg, inputSha, inputBytes, "error"));
    }
    if (soft) return null;
    await reply(ctx, "error", err?.message || "AI không đọc được. Nhập tay ở bảng phía trên.");
    throw err;
  }
}

async function markOk(ctx, meta) {
  await writeUsage(
    ctx.db,
    usageRow(ctx.user.id, ctx.unitId, meta.feature, meta.extracted, meta.inputSha, meta.inputBytes, "ok"),
  );
}

async function turnHeadcount(ctx) {
  const nums = ctx.text.match(/\d+/g) || [];
  const copy = nums.length < 5 ? headcountLike(ctx.text, ctx.payload.date) : null;
  if (copy) return copyHeadcount(ctx, copy);
  const settings = ctx.opts.settings ?? await loadSettings(ctx.db, ctx.unitId);
  const facts = await memoryLines(ctx.db, ctx.user.id, ctx.unitId);
  const profile = await profileOf(ctx.db, ctx.user.id, ctx.unitId);
  const meta = await callExtract(ctx, "kitchen-ledger-headcount", {
    system: `${toneLine(profile.tone)} ${buildHeadcountPrompt(settings, ctx.payload.date)} ${facts.length ? `Ghi nho: ${facts.join(" | ")}` : ""}`,
    user: ctx.text || "Doc anh so cham com. Chi dem nguoi an tung bua va tung muc. Khong chep ten.",
    image: ctx.image ? { mime: ctx.image.mime, base64: ctx.image.base64 } : undefined,
    temperature: 0,
  });
  let draft;
  try {
    draft = normalizeAiHeadcount(meta.extracted.data, { settings, anchorDate: ctx.payload.date });
  } catch (err) {
    await writeUsage(ctx.db, usageRow(
      ctx.user.id, ctx.unitId, meta.feature, meta.extracted, meta.inputSha, meta.inputBytes, "error",
    ));
    await reply(ctx, "error", err?.message || "AI trả về quân số không đúng mẫu.");
    throw err;
  }
  await markOk(ctx, meta);
  return reply(ctx, "headcount_draft", "Bản nháp quân số. Sửa rồi bấm ghi. Số trên sổ chỉ đổi sau khi ghi.", draft);
}

async function copyHeadcount(ctx, copy) {
  const readLedger = ctx.opts.getLedger ?? getLedger;
  const view = await readLedger(
    { unitId: ctx.unitId, date: copy.ref },
    ctx.scope,
    ctx.effectiveUnitIds,
    ctx.dataScope,
  );
  if (!view?.headcountSaved) {
    return reply(ctx, "note", `Ngày ${copy.ref} chưa có quân số trên sổ. Dán đủ số hoặc nhập tay.`);
  }
  const day = {
    date: copy.target,
    headcount: view.headcount,
    confidence: { extras: 1, levels: (view.headcount?.levels || []).map((level) => ({
      dailyAmount: level.dailyAmount, sang: 1, trua: 1, chieu: 1,
    })) },
    warnings: [`Lấy quân số ngày ${copy.ref} trên sổ, không do AI tính.`],
  };
  return reply(ctx, "headcount_draft", `Bản nháp lấy từ ngày ${copy.ref}. Soát lại rồi ghi.`, {
    days: [day],
    warnings: day.warnings,
  });
}

function movementPrompt(commodities) {
  const names = commodities.slice(0, 120).map((row) => `${row.name} (${row.measureUnit})`).join(", ");
  return [
    "Tach cau thanh dong hang. Khong tinh tien, khong ke ten nguoi.",
    "intent: unit_purchase (mua ngoai, don vi mua TT, cot I), unit_tgsx (don vi TGSX, cot J), rice (gao, cot G), other_out (xuat khac, cot P), on_guarantee (tren BD, khong phai gao).",
    "unitPrice la dong. 180k = 180000.",
    names ? `Danh muc: ${names}.` : "",
    'JSON: {"lines":[{"name":"muc","qty":5,"uom":"kg","unitPrice":180000,"intent":"unit_purchase","confidence":0.9}]}',
  ].join(" ");
}

async function turnMovement(ctx) {
  if (!ctx.text) throw fail("Nhập câu hàng. Ảnh hóa đơn để bước sau.", 400);
  const settings = ctx.opts.settings ?? await loadSettings(ctx.db, ctx.unitId);
  const loadCommodities = ctx.opts.loadCommodities ?? ((storageUnitId) => ctx.db.lttpCommodity.findMany({
    where: { unitId: storageUnitId, isActive: true },
    select: { id: true, name: true, measureUnit: true },
    orderBy: { name: "asc" },
    take: 500,
  }));
  const commodities = await loadCommodities(ctx.dataScope.storageUnitId);
  const profile = await profileOf(ctx.db, ctx.user.id, ctx.unitId);
  const meta = await callExtract(ctx, "kitchen-ledger-movement", {
    system: `${toneLine(profile.tone)} ${movementPrompt(commodities)}`,
    user: ctx.text,
    temperature: 0,
  });
  let draft;
  try {
    draft = normalizeMovementDraft(meta.extracted.data, {
      text: ctx.text,
      commodities,
      ricePattern: settings.riceNamePattern,
    });
  } catch (err) {
    await writeUsage(ctx.db, usageRow(
      ctx.user.id, ctx.unitId, meta.feature, meta.extracted, meta.inputSha, meta.inputBytes, "error",
    ));
    await reply(ctx, "error", err?.message || "AI trả về dòng hàng không đúng mẫu.");
    throw err;
  }
  await markOk(ctx, meta);
  return reply(ctx, "movement_draft", "Bản nháp dòng hàng. Giá trên sổ lấy từ bảng giá nếu đã có. Ghi mới vào sổ.", {
    date: ctx.payload.date,
    ...draft,
  });
}

async function turnRule(ctx) {
  if (!ctx.text) throw fail("Dán quy tắc hoặc chọn file .md, .txt.", 400);
  const title = (ctx.payload.ruleTitle || ctx.text.split("\n")[0] || "Quy tắc").trim().slice(0, 120);
  const note = await ctx.db.ledgerAssistantRuleNote.create({
    data: { userId: ctx.user.id, unitId: ctx.unitId, title, body: ctx.text.slice(0, 20_000) },
  });
  const proposals = proposeSettings(ctx.text);
  const content = proposals.length
    ? `Đã lưu «${title}». Bấm áp dụng nếu muốn đổi cấu hình sổ: ${proposals.map((row) => row.label).join("; ")}.`
    : `Đã lưu «${title}» làm ghi chú cho trợ lý. Không thấy mục nào khớp cấu hình sổ.`;
  return reply(ctx, "rule_note", content, { ruleId: note.id, proposals, accepted: false });
}

async function turnQuestion(ctx) {
  const date = questionDate(ctx.text, ctx.payload.date);
  const readLedger = ctx.opts.getLedger ?? getLedger;
  let view;
  try {
    view = await readLedger({ unitId: ctx.unitId, date }, ctx.scope, ctx.effectiveUnitIds, ctx.dataScope);
  } catch (err) {
    return reply(ctx, "answer", err?.message || "Chưa đọc được sổ.");
  }
  let picked = routeQuestion(ctx.text, (view.lines || []).map((line) => line.name));
  if (!picked && aiConfig(ctx.opts).apiKey) {
    const meta = await callExtract(ctx, "kitchen-ledger-question", {
      system: 'Chon mot tool de doc so da tinh. Khong tinh lai. Khong ke ten nguoi. JSON: {"tool":"explain_finance","itemName":""}. tool: explain_finance, anomalies, item_stock, receipts, issues.',
      user: ctx.text,
      temperature: 0,
    }, { soft: true });
    const parsed = meta ? toolSchema.safeParse(meta.extracted.data) : null;
    if (parsed?.success) {
      picked = parsed.data;
      await markOk(ctx, meta);
    }
  }
  if (!picked) {
    return reply(ctx, "answer", "Hỏi cụ thể hơn: thừa thiếu, nhập, xuất, tồn một mặt hàng, hoặc bất thường. Trợ lý chỉ đọc số sổ đã tính.");
  }
  return reply(ctx, "answer", renderTool(picked.tool, view, picked.itemName), {
    tool: picked.tool,
    date,
    itemName: picked.itemName || "",
  });
}

async function applyDraft(payload, user, scope, effectiveUnitIds, dataScope, opts = {}) {
  assertOwner(user);
  const unitId = Number(payload.unitId);
  assertScope(unitId, scope, effectiveUnitIds, dataScope);
  const db = opts.prisma ?? defaultPrisma;
  const message = await ownedMessage(db, Number(payload.messageId), user.id, unitId);
  if (!message) throw fail("Không thấy bản nháp của tài khoản này.", 404, ERROR_CODES.NOT_FOUND);
  if (message.kind === "headcount_draft") {
    return applyHeadcount(message, payload, db, scope, effectiveUnitIds, dataScope, opts);
  }
  if (message.kind === "movement_draft") {
    return applyMovement(message, payload, unitId, db, scope, effectiveUnitIds, dataScope, opts);
  }
  if (message.kind === "rule_note") return applyRule(message, payload, user, db, scope, effectiveUnitIds, dataScope, opts);
  throw fail("Tin này không phải bản nháp để ghi.", 400);
}

async function applyHeadcount(message, payload, db, scope, effectiveUnitIds, dataScope, opts) {
  const days = payload.headcountDays || [];
  if (!days.length) throw fail("Chưa có ngày quân số để ghi.", 400);
  const draftDays = new Map((message.payloadJson?.days || []).map((day) => [day.date, day]));
  for (const day of days) {
    if (!draftDays.has(day.date)) throw fail(`Ngày ${day.date} không có trong bản nháp.`, 400);
  }
  const save = opts.saveLedger ?? saveLedger;
  const changes = [];
  const saved = [];
  for (const day of days) {
    changes.push(...diffHeadcount(draftDays.get(day.date), day.headcount));
    try {
      await save(
        { unitId: payload.unitId, date: day.date, headcount: day.headcount },
        scope,
        effectiveUnitIds,
        dataScope,
      );
      saved.push({ date: day.date, ok: true });
    } catch (err) {
      saved.push({ date: day.date, ok: false, message: err?.message || "Không lưu được." });
    }
  }
  await db.ledgerAssistantMessage.update({
    where: { id: message.id },
    data: { payloadJson: { ...message.payloadJson, confirmed: days, changes, saved } },
  });
  return { messageId: message.id, saved, changes };
}

function existingLines(view, kind) {
  return (view?.movements || []).filter((row) => row.kind === kind).map((row) => {
    if (kind === "self_supply") {
      return {
        commodityId: row.commodityId,
        source: row.source === "J" ? "J" : "I",
        qty: Number(row.qty),
        issuePolicy: row.issuePolicy || "today",
      };
    }
    if (kind === "rice") {
      return {
        commodityId: row.commodityId || undefined,
        name: row.itemName,
        qty: Number(row.qty),
        unitPrice: Number(row.unitPrice),
      };
    }
    return { commodityId: row.commodityId || undefined, name: row.itemName, qty: Number(row.qty) };
  });
}

function matchDraftLines(draftLines, confirmed) {
  const pool = (draftLines || []).filter((line) => line.savable);
  const used = new Set();
  return confirmed.map((row) => {
    const index = pool.findIndex((line, i) => !used.has(i) && normalizeName(line.name) === normalizeName(row.name));
    if (index < 0) throw fail(`«${row.name}» không có trong bản nháp đã khớp danh mục.`, 400);
    used.add(index);
    return { ...pool[index], qty: row.qty, unitPrice: row.unitPrice ?? pool[index].unitPrice };
  });
}

async function applyMovement(message, payload, unitId, db, scope, effectiveUnitIds, dataScope, opts) {
  const confirmed = payload.movementLines || [];
  if (!confirmed.length) throw fail("Chưa có dòng để ghi.", 400);
  const lines = matchDraftLines(message.payloadJson?.lines, confirmed);
  const readLedger = opts.getLedger ?? getLedger;
  const date = message.payloadJson?.date;
  const view = await readLedger({ unitId, date }, scope, effectiveUnitIds, dataScope);
  const grouped = { self_supply: [], rice: [], other_out: [] };
  for (const line of lines) {
    if (!grouped[line.kind]) throw fail("Dòng nháp không ghi được vào sổ.", 400);
    grouped[line.kind].push(line);
  }
  const body = { unitId, date };
  if (grouped.self_supply.length) {
    body.selfSupply = {
      lines: [
        ...existingLines(view, "self_supply"),
        ...grouped.self_supply.map((line) => ({
          commodityId: line.commodityId,
          source: line.source,
          qty: line.qty,
          issuePolicy: line.issuePolicy || "today",
        })),
      ],
    };
  }
  if (grouped.rice.length) {
    body.rice = {
      lines: [
        ...existingLines(view, "rice"),
        ...grouped.rice.map((line) => ({
          commodityId: line.commodityId || undefined,
          name: line.name,
          qty: line.qty,
          unitPrice: line.unitPrice ?? undefined,
        })),
      ],
    };
  }
  if (grouped.other_out.length) {
    body.otherOut = {
      lines: [
        ...existingLines(view, "other_out"),
        ...grouped.other_out.map((line) => ({
          commodityId: line.commodityId || undefined,
          name: line.name,
          qty: line.qty,
        })),
      ],
    };
  }
  const save = opts.saveLedger ?? saveLedger;
  let saved;
  try {
    saved = await save(body, scope, effectiveUnitIds, dataScope);
  } catch (err) {
    saved = { ok: false, message: err?.message || "Không lưu được." };
  }
  await db.ledgerAssistantMessage.update({
    where: { id: message.id },
    data: { payloadJson: { ...message.payloadJson, confirmed, savedOk: saved?.ok !== false } },
  });
  return { messageId: message.id, saved };
}

async function applyRule(message, payload, user, db, scope, effectiveUnitIds, dataScope, opts) {
  if (!payload.acceptProposals) throw fail("Chưa xác nhận áp dụng cấu hình.", 400);
  const proposals = message.payloadJson?.proposals || [];
  if (!proposals.length) throw fail("Ghi chú này không có cấu hình để áp dụng.", 400);
  const save = opts.saveLedgerSettings ?? saveLedgerSettings;
  const settings = await save(
    { unitId: payload.unitId, ...settingsPatch(proposals) },
    user.id,
    scope,
    effectiveUnitIds,
    dataScope,
  );
  await db.ledgerAssistantMessage.update({
    where: { id: message.id },
    data: { payloadJson: { ...message.payloadJson, accepted: true } },
  });
  return { messageId: message.id, settings };
}

export {
  addMemory,
  applyDraft,
  getAssistant,
  postTurn,
  removeMemory,
  removeRule,
  saveProfile,
};
