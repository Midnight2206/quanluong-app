import { normalizeCommodityName } from "../kitchen-books/kitchen-books-menu-ai-map.js";
import { proposeUomFactor } from "./lttp-issue-slip-ai-uom.js";

async function learnConfirmedOrder({
  prisma,
  recipientUnitId,
  recipientUserId,
  issueSlipId,
  orderMessageId,
  aiLines,
  confirmedLines,
}) {
  if (!recipientUnitId || !prisma?.lttpAiFillLog) return { proposals: [] };
  await prisma.lttpAiFillLog.create({
    data: {
      recipientUnitId,
      recipientUserId: recipientUserId || null,
      issueSlipId: issueSlipId || null,
      aiJson: aiLines || [],
      confirmedJson: confirmedLines || [],
    },
  });
  const proposals = [];
  for (let i = 0; i < (confirmedLines || []).length; i += 1) {
    const confirmed = confirmedLines[i];
    const ai = (aiLines || [])[i] || {};
    const commodityId = Number(confirmed.commodityId);
    if (!commodityId) continue;
    const rawName = ai.rawName || confirmed.rawName;
    const rawNorm = normalizeCommodityName(rawName);
    const aliasWeight = confirmed.aliasWeight == null ? 1 : Number(confirmed.aliasWeight);
    if (rawNorm && aliasWeight > 0 && prisma.lttpAiAliasStat) {
      await prisma.lttpAiAliasStat.upsert({
        where: {
          recipientUnitId_rawNorm_commodityId: { recipientUnitId, rawNorm, commodityId },
        },
        create: { recipientUnitId, rawNorm, commodityId, hitCount: aliasWeight },
        update: { hitCount: { increment: aliasWeight } },
      });
    }
    const measureUnit = String(confirmed.measureUnit || ai.measureUnit || ".").slice(0, 64);
    const qty = Number(confirmed.quantity);
    if (prisma.lttpAiCommodityHabit && measureUnit) {
      const existing = await prisma.lttpAiCommodityHabit.findUnique({
        where: {
          recipientUnitId_commodityId_measureUnit: { recipientUnitId, commodityId, measureUnit },
        },
      });
      const samples = Array.isArray(existing?.qtySamples) ? existing.qtySamples : [];
      const nextSamples = [...samples, qty].filter((n) => Number.isFinite(n)).slice(-100);
      await prisma.lttpAiCommodityHabit.upsert({
        where: {
          recipientUnitId_commodityId_measureUnit: { recipientUnitId, commodityId, measureUnit },
        },
        create: {
          recipientUnitId,
          commodityId,
          measureUnit,
          orderCount: 1,
          lastOrderedAt: new Date(),
          qtySamples: nextSamples,
        },
        update: {
          orderCount: { increment: 1 },
          lastOrderedAt: new Date(),
          qtySamples: nextSamples,
        },
      });
    }
    const factor = proposeUomFactor(
      ai.writtenQty,
      ai.writtenUom,
      confirmed.quantity,
      confirmed.measureUnit || ai.measureUnit,
    );
    if (factor) {
      proposals.push({
        recipientUnitId,
        commodityId,
        fromUom: String(ai.writtenUom || ""),
        factor,
      });
    }
  }
  if (orderMessageId && prisma.lttpAiOrderMessage) {
    await prisma.lttpAiOrderMessage.update({
      where: { id: Number(orderMessageId) },
      data: {
        issueSlipId: issueSlipId || null,
        parseResult: {
          items: (confirmedLines || []).map((line, index) => ({
            name: (aiLines || [])[index]?.rawName || line.rawName || "",
            quantity: String(line.quantity ?? ""),
            uom: line.measureUnit || "",
          })),
        },
      },
    });
  }
  return { proposals };
}

async function confirmUomRule({ prisma, recipientUnitId, commodityId, fromUom, factor }) {
  const existing = await prisma.lttpAiUomRule.findFirst({
    where: {
      recipientUnitId,
      commodityId: commodityId ?? null,
      fromUom,
    },
  });
  if (existing) {
    return prisma.lttpAiUomRule.update({
      where: { id: existing.id },
      data: { factor, confirmed: true },
    });
  }
  return prisma.lttpAiUomRule.create({
    data: {
      recipientUnitId,
      commodityId: commodityId ?? null,
      fromUom,
      factor,
      confirmed: true,
    },
  });
}

export { confirmUomRule, learnConfirmedOrder };
