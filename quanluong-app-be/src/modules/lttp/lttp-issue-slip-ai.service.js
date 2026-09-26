import { randomUUID } from "node:crypto";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { formatLocalCatalogForPrompt } from "../kitchen-books/kitchen-books-menu-ai-history.js";
import { assertMenuAiConfigured, completeMenuJson } from "../kitchen-books/kitchen-books-menu-ai-llm.js";
import { enrichLlmIssueSlipDraft } from "./lttp-issue-slip-ai-enrich.js";
import { scopeSanitizeIssueSlipAiHeaderDraft } from "./lttp-issue-slip-ai-header-scope.js";
import { formatMemoriesForPrompt } from "./lttp-issue-slip-ai-memory.js";
import { dropTgsxUnlessSignaled } from "./lttp-issue-slip-ai-tgsx.js";
import {
  buildIssueSlipAiChatPrompt,
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
  const { unitId, prompt, issueDate, receivedDate, recipientUnitId } = payload;
  assertIssueSlipWriteAccess(unitId, scope, effectiveUnitIds, dataScope, callerUnitId);

  const menuAiCfg = opts.configOverride ?? config.menuAi;
  assertMenuAiConfigured(menuAiCfg);
  const prismaClient = getPrismaClient(opts);
  const sessionId = (opts.randomUUID ?? randomUUID)();
  const actorUserId = requireActorUserId(opts.actorUserId);

  const storageUnitId = dataScope.storageUnitId;
  const effDate = resolveIssueSlipAiEffDate(issueDate);

  const loadCatalogFn = opts.loadCatalog ?? loadCatalog;
  const loadHistoryFn = opts.loadHistorySamples ?? loadHistorySamples;
  const loadMemoriesFn = opts.loadMemories ?? ((targetUnitId, args) => loadMemories(targetUnitId, args, prismaClient));
  const loadSuppliersFn = opts.loadDefaultSuppliers ?? loadDefaultSuppliers;
  const getEffectiveFn = opts.getEffectivePrices ?? getEffectivePrices;

  await prismaClient.lttpIssueSlipAiMemory.create({
    data: {
      unitId: storageUnitId,
      sessionId,
      prompt: String(prompt ?? "").trim(),
      turns: [],
      finalPreview: null,
      createdById: actorUserId,
    },
  });

  const [
    { commodities, catalogText },
    { memoryText, memorySampleCount },
    { historyText, historySampleCount },
    eff,
    defaultSupplierByCid,
  ] = await Promise.all([
      loadCatalogFn(storageUnitId),
      loadMemoriesFn(storageUnitId, { limit: 20 }),
      loadHistoryFn(storageUnitId, { recipientUnitId }),
      getEffectiveFn({ unitId, date: effDate }, scope, effectiveUnitIds, dataScope),
      loadSuppliersFn(storageUnitId),
    ]);

  const priceByCid = new Map(eff.items.map((i) => [i.commodity.id, i]));

  const llmPrompt = buildIssueSlipAiPrompt({
    prompt: String(prompt ?? "").trim(),
    issueDate: effDate,
    catalogText,
    memoryText,
    historyText,
    context: { receivedDate, recipientUnitId },
  });

  const complete = opts.completeMenuJson ?? completeMenuJson;
  const llmJson = await complete(llmPrompt, {
    configOverride: menuAiCfg,
    fetchImpl: opts.fetchImpl,
    retryUserHint: "Hay tra lai dung schema header va lines[] (phieu xuat LTTP).",
  });

  const { headerDraft: rawHeader, lines, warnings } = enrichLlmIssueSlipDraft({
    llm: llmJson,
    commodities,
    resolveLine: ({ commodityId, priceKind }) =>
      resolveIssueSlipAiSuggestLine({ commodityId, priceKind }, priceByCid, defaultSupplierByCid),
  });
  const tgsxFiltered = dropTgsxUnlessSignaled({
    lines,
    signalTexts: [String(prompt ?? "").trim()],
    warnings,
  });

  const mergedHeader = mergeHeaderFromRequest(rawHeader, { issueDate, receivedDate });
  const scopeSanitize =
    opts.scopeSanitizeIssueSlipAiHeaderDraft ?? scopeSanitizeIssueSlipAiHeaderDraft;
  const headerDraft = await scopeSanitize(mergedHeader, {
    effectiveUnitIds,
    storageUnitId,
    requestRecipientUnitId: recipientUnitId,
    warnings: tgsxFiltered.warnings,
    deps: opts.headerScopeDeps ?? defaultIssueSlipAiHeaderScopeDeps,
  });

  if (historySampleCount < 3) {
    tgsxFiltered.warnings.unshift("Ít dữ liệu phiếu xuất gần đây — gợi ý có thể kém ổn định.");
  }

  return {
    headerDraft,
    lines: tgsxFiltered.lines,
    warnings: tgsxFiltered.warnings,
    sessionId,
    meta: {
      historySampleCount,
      memorySampleCount,
      model: menuAiCfg.model,
    },
  };
}

async function chatIssueSlipAi(payload, scope, effectiveUnitIds, dataScope, callerUnitId, opts = {}) {
  const { sessionId, unitId, message, currentPreview } = payload;
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
  const loadMemoriesFn = opts.loadMemories ?? ((targetUnitId, args) => loadMemories(targetUnitId, args, prismaClient));
  const loadSuppliersFn = opts.loadDefaultSuppliers ?? loadDefaultSuppliers;
  const getEffectiveFn = opts.getEffectivePrices ?? getEffectivePrices;
  const effDate = resolveIssueSlipAiEffDate(currentPreview?.headerDraft?.issueDate, payload?.issueDate);
  const [{ commodities, catalogText }, { memoryText }, eff, defaultSupplierByCid] = await Promise.all([
    loadCatalogFn(storageUnitId),
    loadMemoriesFn(storageUnitId, { limit: 20 }),
    getEffectiveFn({ unitId, date: effDate }, scope, effectiveUnitIds, dataScope),
    loadSuppliersFn(storageUnitId),
  ]);

  const llmPrompt = buildIssueSlipAiChatPrompt({
    message: String(message ?? "").trim(),
    currentPreview,
    turns,
    catalogText,
    memoryText,
  });

  const complete = opts.completeMenuJson ?? completeMenuJson;
  const llmJson = await complete(llmPrompt, {
    configOverride: menuAiCfg,
    fetchImpl: opts.fetchImpl,
    retryUserHint: "Hay tra lai dung schema header va lines[] (phieu xuat LTTP).",
  });

  const priceByCid = new Map(eff.items.map((i) => [i.commodity.id, i]));
  const enriched = enrichLlmIssueSlipDraft({
    llm: llmJson,
    commodities,
    resolveLine: ({ commodityId, priceKind }) =>
      resolveIssueSlipAiSuggestLine({ commodityId, priceKind }, priceByCid, defaultSupplierByCid),
  });
  const tgsxFiltered = dropTgsxUnlessSignaled({
    lines: enriched.lines,
    warnings: enriched.warnings,
    signalTexts: [memory.prompt, ...turns.map((turn) => turn?.text), String(message ?? "").trim()],
  });

  const scopeSanitize =
    opts.scopeSanitizeIssueSlipAiHeaderDraft ?? scopeSanitizeIssueSlipAiHeaderDraft;
  const headerDraft = await scopeSanitize(enriched.headerDraft, {
    effectiveUnitIds,
    storageUnitId,
    requestRecipientUnitId: currentPreview?.headerDraft?.recipientUnitId ?? null,
    warnings: tgsxFiltered.warnings,
    deps: opts.headerScopeDeps ?? defaultIssueSlipAiHeaderScopeDeps,
  });

  const at = (opts.now ? opts.now() : new Date()).toISOString();
  const nextTurns = [
    ...turns,
    { role: "user", text: String(message ?? "").trim(), at },
    { role: "assistant", text: buildAssistantTurnText(headerDraft, tgsxFiltered.lines), at },
  ];
  await prismaClient.lttpIssueSlipAiMemory.update({
    where: { sessionId },
    data: { turns: nextTurns },
  });

  return {
    headerDraft,
    lines: tgsxFiltered.lines,
    warnings: tgsxFiltered.warnings,
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
  { sessionId, unitId, issueSlipId },
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
}

export {
  buildIssueSlipAiHistoryWhere,
  buildIssueSlipAiPrompt,
  chatIssueSlipAi,
  commitIssueSlipAiMemory,
  linkIssueSlipAiMemory,
  suggestIssueSlipAi,
};
