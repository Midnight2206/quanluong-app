import { hasTgsxSignal } from "./lttp-issue-slip-ai-tgsx.js";
import { buildExtractPrompt, buildPickPrompt } from "./lttp-issue-slip-ai-extract.js";
import { applyScoreGate } from "./lttp-issue-slip-ai-accept.js";
import { applyLlmPick, decideMatch } from "./lttp-issue-slip-ai-match.js";
import {
  lineNoteForItem,
  quantityTokenForConvert,
  takeLastParen,
} from "./lttp-issue-slip-ai-line-note.js";
import { convertQuantity } from "./lttp-issue-slip-ai-uom.js";

function finishLine(item, decision, ctx) {
  const commodity = (ctx.commodities || []).find((row) => row.id === decision.commodityId) || null;
  const habit =
    (ctx.habits || [])
      .filter((row) => row.commodityId === decision.commodityId)
      .sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))[0] || null;
  const price = decision.commodityId ? ctx.priceByCid.get(decision.commodityId) : null;
  const paren = takeLastParen(item?.name);
  const converted = convertQuantity({
    writtenQty: quantityTokenForConvert(item?.quantity),
    writtenUom: item?.uom,
    unitPrice: price?.unitPrice ?? null,
    stockUom: commodity?.measureUnit,
    habitUom: habit?.measureUnit,
    commodityId: decision.commodityId,
    rules: ctx.rules,
  });
  const note = lineNoteForItem({
    writtenQty: item?.quantity,
    writtenUom: item?.uom,
    parenText: paren.parenText,
    stockUom: commodity?.measureUnit,
    originalQtyOnConvert: Boolean(ctx.originalQtyOnConvert),
  });
  const skuReady = Boolean(decision.commodityId) && !decision.needsConfirm;
  const askRule = converted.source === "unknown-uom";
  const needsConfirm = Boolean(!skuReady || askRule);
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
    commodityId: skuReady ? Number(decision.commodityId) : null,
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
    rawName: paren.name,
    writtenQty: item?.quantity ?? null,
    writtenUom: item?.uom ?? "",
    parenText: paren.parenText,
    lineNote: note.lineNote,
    stockUom: commodity?.measureUnit || null,
    askRule,
    qtySource: converted.source,
    qtyFactor: converted.factor ?? null,
    qtyFromUom: converted.fromUom || null,
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
  autoAcceptPercent = null,
  originalQtyOnConvert = false,
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
      if (autoAcceptPercent != null) {
        decision = applyScoreGate(decision, commodities, autoAcceptPercent);
      }
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
          originalQtyOnConvert: Boolean(originalQtyOnConvert),
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
