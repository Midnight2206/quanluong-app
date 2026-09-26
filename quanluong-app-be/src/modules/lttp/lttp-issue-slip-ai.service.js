import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { config } from "../../config/config.js";
import { formatLocalCatalogForPrompt } from "../kitchen-books/kitchen-books-menu-ai-history.js";
import { assertMenuAiConfigured, completeMenuJson } from "../kitchen-books/kitchen-books-menu-ai-llm.js";
import { enrichLlmIssueSlipDraft } from "./lttp-issue-slip-ai-enrich.js";
import { scopeSanitizeIssueSlipAiHeaderDraft } from "./lttp-issue-slip-ai-header-scope.js";
import { buildIssueSlipAiPrompt, formatIssueSlipHistoryForPrompt } from "./lttp-issue-slip-ai.prompt.js";
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

async function loadHistorySamples(storageUnitId, limit = 20) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 20);
  const slips = await prisma.lttpIssueSlip.findMany({
    where: { unitId: storageUnitId },
    orderBy: [{ issueDate: "desc" }, { id: "desc" }],
    take,
    select: {
      issueDate: true,
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

async function loadDefaultSuppliers(storageUnitId) {
  const rows = await prisma.lttpCommodityDefaultSupplier.findMany({
    where: { commodity: { unitId: storageUnitId, isActive: true } },
    select: { commodityId: true, lttpSupplierId: true },
  });
  return new Map(rows.map((r) => [r.commodityId, r.lttpSupplierId]));
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

  const storageUnitId = dataScope.storageUnitId;
  const effDate =
    issueDate != null && String(issueDate).trim() !== ""
      ? String(issueDate).trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const loadCatalogFn = opts.loadCatalog ?? loadCatalog;
  const loadHistoryFn = opts.loadHistorySamples ?? loadHistorySamples;
  const loadSuppliersFn = opts.loadDefaultSuppliers ?? loadDefaultSuppliers;
  const getEffectiveFn = opts.getEffectivePrices ?? getEffectivePrices;

  const [{ commodities, catalogText }, { historyText, historySampleCount }, eff, defaultSupplierByCid] =
    await Promise.all([
      loadCatalogFn(storageUnitId),
      loadHistoryFn(storageUnitId),
      getEffectiveFn({ unitId, date: effDate }, scope, effectiveUnitIds, dataScope),
      loadSuppliersFn(storageUnitId),
    ]);

  const priceByCid = new Map(eff.items.map((i) => [i.commodity.id, i]));

  const llmPrompt = buildIssueSlipAiPrompt({
    prompt: String(prompt ?? "").trim(),
    issueDate: effDate,
    catalogText,
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

  const mergedHeader = mergeHeaderFromRequest(rawHeader, { issueDate, receivedDate });
  const scopeSanitize =
    opts.scopeSanitizeIssueSlipAiHeaderDraft ?? scopeSanitizeIssueSlipAiHeaderDraft;
  const headerDraft = await scopeSanitize(mergedHeader, {
    effectiveUnitIds,
    storageUnitId,
    requestRecipientUnitId: recipientUnitId,
    warnings,
    deps: opts.headerScopeDeps ?? defaultIssueSlipAiHeaderScopeDeps,
  });

  if (historySampleCount < 3) {
    warnings.unshift("Ít dữ liệu phiếu xuất gần đây — gợi ý có thể kém ổn định.");
  }

  return {
    headerDraft,
    lines,
    warnings,
    meta: {
      historySampleCount,
      model: menuAiCfg.model,
    },
  };
}

export { buildIssueSlipAiPrompt, suggestIssueSlipAi };
