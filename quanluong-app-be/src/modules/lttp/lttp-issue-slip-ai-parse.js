import { hasTgsxSignal } from "./lttp-issue-slip-ai-tgsx.js";
import { buildExtractPrompt, buildPickPrompt } from "./lttp-issue-slip-ai-extract.js";
import { applyLlmPick, decideMatch } from "./lttp-issue-slip-ai-match.js";
import { convertQuantity } from "./lttp-issue-slip-ai-uom.js";

function finishLine(item, decision, ctx) {
  const commodity = (ctx.commodities || []).find((row) => row.id === decision.commodityId) || null;
  const habit = (ctx.habits || []).find((row) => row.commodityId === decision.commodityId) || null;
  const price = decision.commodityId ? ctx.priceByCid.get(decision.commodityId) : null;
  const converted = convertQuantity({
    writtenQty: item?.quantity,
    writtenUom: item?.uom,
    unitPrice: price?.unitPrice ?? null,
    stockUom: commodity?.measureUnit,
    habitUom: habit?.measureUnit,
    commodityId: decision.commodityId,
    rules: ctx.rules,
  });
  const needsConfirm = Boolean(decision.needsConfirm || converted.needsConfirm || !decision.commodityId);
  const priceKind = hasTgsxSignal(ctx.signalText) ? "tgsx" : "market";
  const resolved =
    decision.commodityId && !needsConfirm
      ? ctx.resolveLine({ commodityId: decision.commodityId, priceKind })
      : { lttpSupplierId: null, unitPrice: null, tgsxPrice: null };
  const supplierId =
    resolved?.lttpSupplierId != null ? Number(resolved.lttpSupplierId) : null;
  const mapped = !needsConfirm && Number.isInteger(supplierId) && supplierId > 0;
  const choices = (decision.choices || []).slice(0, 3).map((choice) => {
    const choicePrice = ctx.priceByCid.get(choice.commodityId);
    const choiceResolved = ctx.resolveLine({ commodityId: choice.commodityId, priceKind });
    return {
      ...choice,
      lttpSupplierId: choiceResolved?.lttpSupplierId ?? null,
      unitPrice: choiceResolved?.unitPrice ?? choicePrice?.unitPrice ?? null,
      tgsxPrice: choiceResolved?.tgsxPrice ?? null,
      measureUnit: ctx.commodities.find((row) => row.id === choice.commodityId)?.measureUnit || null,
    };
  });
  return {
    commodityName: commodity?.name || String(item?.name || ""),
    code: commodity?.code || null,
    commodityId: mapped ? Number(decision.commodityId) : null,
    quantity: converted.quantity,
    measureUnit: converted.measureUnit,
    priceKind,
    mapped,
    needsConfirm,
    lttpSupplierId: mapped ? supplierId : null,
    unitPrice: resolved?.unitPrice ?? price?.unitPrice ?? null,
    tgsxPrice: resolved?.tgsxPrice ?? null,
    source: decision.source || "none",
    confidence: decision.confidence ?? 0,
    choices,
    rawName: String(item?.name || ""),
    writtenQty: item?.quantity ?? null,
    writtenUom: item?.uom ?? "",
  };
}

async function parseOrderItems({
  text,
  commodities,
  habits,
  aliases,
  rules,
  examples,
  includeExamples,
  priceByCid,
  resolveLine,
  complete,
  completeOpts,
  now = new Date(),
}) {
  const extracted = await complete(buildExtractPrompt({ text, examples: includeExamples ? examples : [] }), {
    ...completeOpts,
    retryUserHint: "Hay tra JSON items[{name,quantity,uom}].",
  });
  const items = Array.isArray(extracted?.items) ? extracted.items.slice(0, 80) : [];
  const rows = await Promise.all(
    items.map(async (item, index) => {
      let decision = decideMatch({
        rawName: item?.name,
        commodities,
        habits,
        aliases,
        now,
      });
      if (decision.needsLlm) {
        try {
          const pick = await complete(
            buildPickPrompt({ name: item?.name, choices: decision.choices }),
            { ...completeOpts, retryUserHint: "Hay tra JSON {sku,conf}." },
          );
          decision = applyLlmPick(decision, pick);
        } catch {
          decision = {
            ...decision,
            needsLlm: false,
            needsConfirm: true,
            commodityId: null,
            choices: (decision.choices || []).slice(0, 3),
          };
        }
      }
      return {
        index,
        line: finishLine(item, decision, {
          commodities,
          habits,
          rules,
          priceByCid,
          resolveLine,
          signalText: text,
        }),
      };
    }),
  );
  rows.sort((a, b) => a.index - b.index);
  const lines = rows.map((row) => row.line);
  const warnings = lines
    .filter((line) => line.needsConfirm)
    .map((line) => `Cần xác nhận: ${line.rawName || "dòng hàng"}`);
  return { items, lines, warnings };
}

export { parseOrderItems };
