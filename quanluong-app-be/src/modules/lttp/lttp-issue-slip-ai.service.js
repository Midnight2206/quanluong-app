import { randomUUID } from "node:crypto";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { formatLocalCatalogForPrompt } from "../kitchen-books/kitchen-books-menu-ai-history.js";
import { assertMenuAiConfigured, completeMenuJson } from "../kitchen-books/kitchen-books-menu-ai-llm.js";
import { scopeSanitizeIssueSlipAiHeaderDraft } from "./lttp-issue-slip-ai-header-scope.js";
import { formatMemoriesForPrompt } from "./lttp-issue-slip-ai-memory.js";
import { createIssueSlipAiDraft } from "./lttp-issue-slip-ai-draft.js";
import {
  confirmUomRule,
  learnConfirmedOrder,
  loadConfirmedQtyRules,
  loadOriginalQtyOnConvert,
} from "./lttp-issue-slip-ai-learn.js";
import { parseOrderItems } from "./lttp-issue-slip-ai-parse.js";
import { bindSharedQtyRules } from "./lttp-issue-slip-ai-uom.js";
import { readAutoAcceptPercent } from "./lttp-issue-slip-ai-accept.js";
import {
  buildIssueSlipAiPrompt,
  formatIssueSlipHistoryForPrompt,
} from "./lttp-issue-slip-ai.prompt.js";
import {
  assertIssueSlipWriteAccess,
  assertBuyerUserAllowedForStorage,
  assertRecipientUserAllowedForUnit,
  assertUnitInEffectiveBranch,
  getEffectivePrices,
  resolveIssueSlipAiSuggestLine,
} from "./lttp.service.js";

const defaultIssueSlipAiHeaderScopeDeps = {
  assertUnitInBranch: assertUnitInEffectiveBranch,
  assertBuyer: assertBuyerUserAllowedForStorage,
  assertRecipientUser: assertRecipientUserAllowedForUnit,
};

function getPrismaClient(opts) {
  return opts.prismaClient ?? prisma;
}

async function loadAiStats(recipientUnitId, recipientUserId, prismaClient, storageUnitId) {
  if (!recipientUnitId || !prismaClient.lttpAiCommodityHabit) {
    return { habits: [], aliases: [], rules: [], examples: [] };
  }
  const [habits, aliases, rules] = await Promise.all([
    prismaClient.lttpAiCommodityHabit.findMany({ where: { recipientUnitId } }),
    prismaClient.lttpAiAliasStat.findMany({ where: { recipientUnitId } }),
    loadConfirmedQtyRules(prismaClient, recipientUnitId, storageUnitId),
  ]);
  let examples = [];
  if (prismaClient.lttpAiOrderMessage) {
    const personal = recipientUserId
      ? await prismaClient.lttpAiOrderMessage.findMany({
          where: { recipientUserId, issueSlipId: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 3,
        })
      : [];
    const rows = personal.length
      ? personal
      : await prismaClient.lttpAiOrderMessage.findMany({
          where: { issueSlipId: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 3,
        });
    examples = rows.map((row) => ({
      rawText: row.rawText,
      items: row.parseResult?.items || [],
    }));
  }
  return { habits, aliases, rules, examples };
}

function buildAssistantTurnText(headerDraft, lines) {
  // ponytail: store a short JSON snapshot, not the full preview; upgrade to richer summaries if chat quality suffers.
  const text = JSON.stringify({
    headerDraft,
    lines: (Array.isArray(lines) ? lines : []).map((line) => line?.commodityName || line?.code || "?"),
  });
  if (!text) {
    return "{}";
  }
  return text.length <= 500 ? text : `${text.slice(0, 497)}...`;
}

function requireMemoryBelongsToUnit(memory, unitId) {
  if (!memory || Number(memory.unitId) !== Number(unitId)) {
    throw new AppError({
      message: "Không tìm thấy phiên AI phiếu xuất cho đơn vị này.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
}

function requireIssueSlipBelongsToUnit(issueSlip, unitId) {
  if (!issueSlip || Number(issueSlip.unitId) !== Number(unitId)) {
    throw new AppError({
      message: "Không tìm thấy phiếu xuất thuộc phiên AI này.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
}

async function loadCatalog(storageUnitId) {
  const commodities = await prisma.lttpCommodity.findMany({
    where: { unitId: storageUnitId, isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, name: true, code: true, measureUnit: true },
  });
  return {
    commodities,
    catalogText: formatLocalCatalogForPrompt(commodities, []),
  };
}

function buildIssueSlipAiHistoryWhere(storageUnitId, { recipientUnitId } = {}) {
  const where = { unitId: storageUnitId };
  if (recipientUnitId != null) {
    where.recipientUnitId = recipientUnitId;
  }
  return where;
}

async function loadHistorySamples(storageUnitId, { recipientUnitId, limit = 20 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 20);
  const slips = await prisma.lttpIssueSlip.findMany({
    where: buildIssueSlipAiHistoryWhere(storageUnitId, { recipientUnitId }),
    orderBy: [{ issueDate: "desc" }, { id: "desc" }],
    take,
    select: {
      issueDate: true,
      recipientUnitId: true,
      note: true,
      lines: {
        orderBy: { id: "asc" },
        select: {
          quantity: true,
          priceKind: true,
          commodity: { select: { name: true, code: true } },
        },
      },
    },
  });
  return {
    historyText: formatIssueSlipHistoryForPrompt(slips),
    historySampleCount: slips.length,
  };
}

async function loadMemories(unitId, { limit = 20 } = {}, prismaClient = prisma) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 20);
  const rows = await prismaClient.lttpIssueSlipAiMemory.findMany({
    where: {
      unitId,
      finalPreview: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      issueSlipId: true,
      prompt: true,
      turns: true,
      finalPreview: true,
      updatedAt: true,
    },
  });
  return {
    memoryText: formatMemoriesForPrompt(rows),
    memorySampleCount: rows.length,
  };
}

async function loadDefaultSuppliers(storageUnitId) {
  const rows = await prisma.lttpCommodityDefaultSupplier.findMany({
    where: { commodity: { unitId: storageUnitId, isActive: true } },
    select: { commodityId: true, lttpSupplierId: true },
  });
  return new Map(rows.map((r) => [r.commodityId, r.lttpSupplierId]));
}

function resolveIssueSlipAiEffDate(...candidates) {
  for (const candidate of candidates) {
    if (candidate != null && String(candidate).trim() !== "") {
      return String(candidate).trim().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function requireActorUserId(actorUserId) {
  const value = Number(actorUserId);
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError({
      message: "Thiếu người thực hiện để lưu phiên AI phiếu xuất.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return value;
}

function mergeHeaderFromRequest(headerDraft, body) {
  const issueDate = body.issueDate != null ? String(body.issueDate).trim() : "";
  const receivedDate = body.receivedDate != null ? String(body.receivedDate).trim() : "";
  return {
    ...headerDraft,
    issueDate: headerDraft.issueDate ?? (issueDate || null),
    receivedDate: headerDraft.receivedDate ?? (receivedDate || null),
  };
}

async function suggestIssueSlipAi(
  payload,
  scope,
  effectiveUnitIds,
  dataScope,
  callerUnitId,
  opts = {},
) {
  const { unitId, prompt, issueDate, receivedDate, recipientUnitId, recipientUserId } = payload;
  assertIssueSlipWriteAccess(unitId, scope, effectiveUnitIds, dataScope, callerUnitId);

  const menuAiCfg = opts.configOverride ?? config.menuAi;
  assertMenuAiConfigured(menuAiCfg);
  const prismaClient = getPrismaClient(opts);
  const sessionId = (opts.randomUUID ?? randomUUID)();
  const actorUserId = requireActorUserId(opts.actorUserId);

  const storageUnitId = dataScope.storageUnitId;
  const effDate = resolveIssueSlipAiEffDate(issueDate);

  const loadCatalogFn = opts.loadCatalog ?? loadCatalog;
  const loadSuppliersFn = opts.loadDefaultSuppliers ?? loadDefaultSuppliers;
  const getEffectiveFn = opts.getEffectivePrices ?? getEffectivePrices;
  const loadStatsFn = opts.loadAiStats ?? ((unit, userId) => loadAiStats(unit, userId, prismaClient, storageUnitId));
  const text = String(prompt ?? "").trim();

  await prismaClient.lttpIssueSlipAiMemory.create({
    data: {
      unitId: storageUnitId,
      sessionId,
      prompt: text,
      turns: [],
      finalPreview: null,
      createdById: actorUserId,
    },
  });

  const [{ commodities }, stats, eff, defaultSupplierByCid, autoAcceptPercent] = await Promise.all([
    loadCatalogFn(storageUnitId),
    loadStatsFn(recipientUnitId, recipientUserId),
    getEffectiveFn({ unitId, date: effDate }, scope, effectiveUnitIds, dataScope),
    loadSuppliersFn(storageUnitId),
    readAutoAcceptPercent(prismaClient, storageUnitId),
  ]);

  const priceByCid = new Map(eff.items.map((i) => [i.commodity.id, i]));
  const complete = opts.completeMenuJson ?? completeMenuJson;
  const parsed = await parseOrderItems({
    text,
    commodities,
    habits: stats.habits,
    aliases: stats.aliases,
    rules: bindSharedQtyRules(stats.rules, commodities),
    examples: stats.examples,
    includeExamples: true,
    priceByCid,
    resolveLine: ({ commodityId, priceKind }) =>
      resolveIssueSlipAiSuggestLine({ commodityId, priceKind }, priceByCid, defaultSupplierByCid),
    complete,
    completeOpts: { configOverride: menuAiCfg, fetchImpl: opts.fetchImpl },
    autoAcceptPercent,
    originalQtyOnConvert:
      opts.originalQtyOnConvert != null
        ? Boolean(opts.originalQtyOnConvert)
        : await loadOriginalQtyOnConvert(prismaClient, storageUnitId),
  });

  let orderMessageId = null;
  if (recipientUnitId && prismaClient.lttpAiOrderMessage) {
    const saved = await prismaClient.lttpAiOrderMessage.create({
      data: {
        recipientUserId: recipientUserId || null,
        recipientUnitId,
        storageUnitId,
        rawText: text,
        parseResult: { items: parsed.items, lines: parsed.lines },
      },
    });
    orderMessageId = saved.id;
  }

  const draft = await createIssueSlipAiDraft(prismaClient, {
    storageUnitId,
    recipientUnitId,
    recipientUserId,
    orderMessageId,
    rawText: text,
    lines: parsed.lines,
    actorUserId,
  });

  const mergedHeader = mergeHeaderFromRequest({}, { issueDate, receivedDate });
  const scopeSanitize =
    opts.scopeSanitizeIssueSlipAiHeaderDraft ?? scopeSanitizeIssueSlipAiHeaderDraft;
  const headerDraft = await scopeSanitize(mergedHeader, {
    effectiveUnitIds,
    storageUnitId,
    requestRecipientUnitId: recipientUnitId,
    warnings: parsed.warnings,
    deps: opts.headerScopeDeps ?? defaultIssueSlipAiHeaderScopeDeps,
  });

  if (!stats.habits.length) {
    parsed.warnings.unshift("Đơn vị nhận chưa có thói quen đặt hàng — dòng lạ sẽ cần xác nhận.");
  }

  const lines = parsed.lines.map((line, index) => {
    const saved = draft?.lines?.[index];
    if (!saved) return line;
    return { ...line, draftLineId: saved.id, lineStatus: saved.status };
  });

  return {
    headerDraft,
    lines,
    warnings: parsed.warnings,
    sessionId,
    meta: {
      historySampleCount: stats.habits.length,
      memorySampleCount: stats.examples.length,
      orderMessageId,
      draftId: draft?.id ?? null,
      draftVersion: draft?.version ?? null,
      model: menuAiCfg.model,
    },
  };
}

async function chatIssueSlipAi(payload, scope, effectiveUnitIds, dataScope, callerUnitId, opts = {}) {
  const { sessionId, unitId, message, currentPreview, recipientUnitId, recipientUserId } = payload;
  assertIssueSlipWriteAccess(unitId, scope, effectiveUnitIds, dataScope, callerUnitId);

  const menuAiCfg = opts.configOverride ?? config.menuAi;
  assertMenuAiConfigured(menuAiCfg);
  const prismaClient = getPrismaClient(opts);
  const storageUnitId = dataScope.storageUnitId;
  const memory = await prismaClient.lttpIssueSlipAiMemory.findUnique({
    where: { sessionId },
  });
  requireMemoryBelongsToUnit(memory, storageUnitId);

  const turns = Array.isArray(memory.turns) ? memory.turns : [];
  if (turns.length >= 20) {
    throw new AppError({
      message: "Phiên AI đã đủ 20 lượt trao đổi. Hãy tạo gợi ý mới.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const loadCatalogFn = opts.loadCatalog ?? loadCatalog;
  const loadSuppliersFn = opts.loadDefaultSuppliers ?? loadDefaultSuppliers;
  const getEffectiveFn = opts.getEffectivePrices ?? getEffectivePrices;
  const loadStatsFn = opts.loadAiStats ?? ((unit, userId) => loadAiStats(unit, userId, prismaClient, storageUnitId));
  const text = String(message ?? "").trim();
  const habitUnitId = recipientUnitId ?? currentPreview?.headerDraft?.recipientUnitId ?? null;
  const effDate = resolveIssueSlipAiEffDate(currentPreview?.headerDraft?.issueDate, payload?.issueDate);
  const [{ commodities }, stats, eff, defaultSupplierByCid, autoAcceptPercent] = await Promise.all([
    loadCatalogFn(storageUnitId),
    loadStatsFn(habitUnitId, recipientUserId),
    getEffectiveFn({ unitId, date: effDate }, scope, effectiveUnitIds, dataScope),
    loadSuppliersFn(storageUnitId),
    readAutoAcceptPercent(prismaClient, storageUnitId),
  ]);

  const priceByCid = new Map(eff.items.map((i) => [i.commodity.id, i]));
  const complete = opts.completeMenuJson ?? completeMenuJson;
  const parsed = await parseOrderItems({
    text,
    commodities,
    habits: stats.habits,
    aliases: stats.aliases,
    rules: bindSharedQtyRules(stats.rules, commodities),
    examples: [],
    includeExamples: false,
    priceByCid,
    resolveLine: ({ commodityId, priceKind }) =>
      resolveIssueSlipAiSuggestLine({ commodityId, priceKind }, priceByCid, defaultSupplierByCid),
    complete,
    completeOpts: { configOverride: menuAiCfg, fetchImpl: opts.fetchImpl },
    now: opts.now ? opts.now() : new Date(),
    autoAcceptPercent,
    originalQtyOnConvert:
      opts.originalQtyOnConvert != null
        ? Boolean(opts.originalQtyOnConvert)
        : await loadOriginalQtyOnConvert(prismaClient, storageUnitId),
  });

  const scopeSanitize =
    opts.scopeSanitizeIssueSlipAiHeaderDraft ?? scopeSanitizeIssueSlipAiHeaderDraft;
  const headerDraft = await scopeSanitize(currentPreview?.headerDraft || {}, {
    effectiveUnitIds,
    storageUnitId,
    requestRecipientUnitId: habitUnitId,
    warnings: parsed.warnings,
    deps: opts.headerScopeDeps ?? defaultIssueSlipAiHeaderScopeDeps,
  });

  const at = (opts.now ? opts.now() : new Date()).toISOString();
  const nextTurns = [
    ...turns,
    { role: "user", text, at },
    { role: "assistant", text: buildAssistantTurnText(headerDraft, parsed.lines), at },
  ];
  await prismaClient.lttpIssueSlipAiMemory.update({
    where: { sessionId },
    data: { turns: nextTurns },
  });

  return {
    headerDraft,
    lines: parsed.lines,
    warnings: parsed.warnings,
    sessionId,
    meta: {
      memorySampleCount: turns.length,
      model: menuAiCfg.model,
    },
  };
}

async function commitIssueSlipAiMemory(
  { sessionId, unitId, finalPreview },
  scope,
  effectiveUnitIds,
  dataScope,
  callerUnitId,
  opts = {},
) {
  assertIssueSlipWriteAccess(unitId, scope, effectiveUnitIds, dataScope, callerUnitId);
  const prismaClient = getPrismaClient(opts);
  const storageUnitId = dataScope.storageUnitId;
  const result = await prismaClient.lttpIssueSlipAiMemory.updateMany({
    where: { sessionId, unitId: storageUnitId },
    data: {
      finalPreview,
    },
  });
  if (!result?.count) {
    throw new AppError({
      message: "Không tìm thấy phiên AI để lưu preview cuối.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
}

async function linkIssueSlipAiMemory(
  {
    sessionId,
    unitId,
    issueSlipId,
    recipientUnitId,
    recipientUserId,
    orderMessageId,
    aiLines,
    confirmedLines,
  },
  scope,
  effectiveUnitIds,
  dataScope,
  callerUnitId,
  opts = {},
) {
  assertIssueSlipWriteAccess(unitId, scope, effectiveUnitIds, dataScope, callerUnitId);
  const prismaClient = getPrismaClient(opts);
  const storageUnitId = dataScope.storageUnitId;
  const [memory, issueSlip] = await Promise.all([
    prismaClient.lttpIssueSlipAiMemory.findUnique({ where: { sessionId } }),
    prismaClient.lttpIssueSlip.findUnique({
      where: { id: issueSlipId },
      select: { id: true, unitId: true },
    }),
  ]);
  requireMemoryBelongsToUnit(memory, storageUnitId);
  requireIssueSlipBelongsToUnit(issueSlip, storageUnitId);

  await prismaClient.lttpIssueSlipAiMemory.update({
    where: { sessionId },
    data: {
      issueSlipId,
    },
  });

  const learned = await learnConfirmedOrder({
    prisma: prismaClient,
    recipientUnitId: recipientUnitId || null,
    recipientUserId: recipientUserId || null,
    issueSlipId,
    orderMessageId: orderMessageId || null,
    aiLines: aiLines || memory.finalPreview?.lines || [],
    confirmedLines: confirmedLines || [],
  });
  return { proposals: learned.proposals };
}

async function confirmIssueSlipAiUomRule(
  { unitId, recipientUnitId, commodityId, fromUom, factor },
  scope,
  effectiveUnitIds,
  dataScope,
  callerUnitId,
  opts = {},
) {
  assertIssueSlipWriteAccess(unitId, scope, effectiveUnitIds, dataScope, callerUnitId);
  const prismaClient = getPrismaClient(opts);
  if (!prismaClient.lttpAiUomRule) return null;
  return confirmUomRule({
    prisma: prismaClient,
    recipientUnitId,
    commodityId: commodityId ?? null,
    fromUom: String(fromUom || "").slice(0, 64),
    factor,
  });
}

export {
  buildIssueSlipAiHistoryWhere,
  buildIssueSlipAiPrompt,
  chatIssueSlipAi,
  commitIssueSlipAiMemory,
  confirmIssueSlipAiUomRule,
  linkIssueSlipAiMemory,
  suggestIssueSlipAi,
};
