import { normalizeCommodityName } from "../kitchen-books/kitchen-books-menu-ai-map.js";
import { proposeUomFactor } from "./lttp-issue-slip-ai-uom.js";

const LINE_NOTE_KIND = "originalQtyOnConvert";

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

async function confirmUomRule({
  prisma,
  recipientUnitId,
  commodityId,
  fromUom,
  factor,
  sharedLevel1 = false,
  commodityNameNorm = null,
  omitUsesFromUom = false,
}) {
  const shared = Boolean(sharedLevel1);
  const nameNorm = shared ? commodityNameNorm || null : null;
  const existing = await prisma.lttpAiUomRule.findFirst({
    where: {
      recipientUnitId,
      commodityId: commodityId ?? null,
      fromUom,
      sharedLevel1: shared,
      ...(shared ? { commodityNameNorm: nameNorm } : {}),
    },
  });
  if (existing) {
    const previous = {
      factor: Number(existing.factor),
      omitUsesFromUom: Boolean(existing.omitUsesFromUom),
    };
    const row = await prisma.lttpAiUomRule.update({
      where: { id: existing.id },
      data: {
        factor,
        confirmed: true,
        sharedLevel1: shared,
        commodityNameNorm: nameNorm,
        ...(omitUsesFromUom ? { omitUsesFromUom: true } : {}),
      },
    });
    const cleared = [];
    if (omitUsesFromUom && nameNorm) {
      const others = await prisma.lttpAiUomRule.findMany({
        where: { sharedLevel1: true, commodityNameNorm: nameNorm, omitUsesFromUom: true, NOT: { id: row.id } },
      });
      for (const other of others) {
        await prisma.lttpAiUomRule.update({
          where: { id: other.id },
          data: { omitUsesFromUom: false },
        });
        cleared.push({ id: other.id, omitUsesFromUom: true });
      }
    }
    return Object.assign(row, { created: false, previous, cleared });
  }
  const row = await prisma.lttpAiUomRule.create({
    data: {
      recipientUnitId,
      commodityId: commodityId ?? null,
      fromUom,
      factor,
      confirmed: true,
      sharedLevel1: shared,
      commodityNameNorm: nameNorm,
      omitUsesFromUom: Boolean(omitUsesFromUom),
    },
  });
  const cleared = [];
  if (omitUsesFromUom && nameNorm) {
    const others = await prisma.lttpAiUomRule.findMany({
      where: { sharedLevel1: true, commodityNameNorm: nameNorm, omitUsesFromUom: true, NOT: { id: row.id } },
    });
    for (const other of others) {
      await prisma.lttpAiUomRule.update({
        where: { id: other.id },
        data: { omitUsesFromUom: false },
      });
      cleared.push({ id: other.id, omitUsesFromUom: true });
    }
  }
  return Object.assign(row, { created: true, previous: null, cleared });
}

async function loadOriginalQtyOnConvert(prisma, storageUnitId) {
  if (!prisma?.lttpAiLineNoteRule || !prisma?.unit?.findUnique) return false;
  const storage = await prisma.unit.findUnique({
    where: { id: Number(storageUnitId) },
    select: { depth: true },
  });
  if (storage?.depth !== 0) return false;
  const row = await prisma.lttpAiLineNoteRule.findUnique({ where: { kind: LINE_NOTE_KIND } });
  return Boolean(row?.enabled);
}

async function setOriginalQtyOnConvert(prisma, enabled) {
  if (!prisma?.lttpAiLineNoteRule?.findUnique || !prisma?.lttpAiLineNoteRule?.upsert) {
    return { previous: false, created: false };
  }
  const existing = await prisma.lttpAiLineNoteRule.findUnique({ where: { kind: LINE_NOTE_KIND } });
  const previous = Boolean(existing?.enabled);
  const created = !existing;
  const nextEnabled = Boolean(enabled);
  await prisma.lttpAiLineNoteRule.upsert({
    where: { kind: LINE_NOTE_KIND },
    update: { enabled: nextEnabled },
    create: { kind: LINE_NOTE_KIND, enabled: nextEnabled },
  });
  return { previous, created };
}

async function loadConfirmedQtyRules(prisma, recipientUnitId, storageUnitId) {
  if (!prisma?.lttpAiUomRule) return [];
  const own = recipientUnitId
    ? await prisma.lttpAiUomRule.findMany({
        where: { recipientUnitId, confirmed: true, sharedLevel1: false },
      })
    : [];
  if (!storageUnitId || !prisma.unit?.findUnique) return own;
  const storage = await prisma.unit.findUnique({
    where: { id: Number(storageUnitId) },
    select: { depth: true },
  });
  if (storage?.depth !== 0) return own;
  const shared = await prisma.lttpAiUomRule.findMany({
    where: { sharedLevel1: true, confirmed: true },
  });
  const seen = new Set(own.map((rule) => rule.id));
  return [...own, ...shared.filter((rule) => rule?.id == null || !seen.has(rule.id))];
}

export {
  LINE_NOTE_KIND,
  confirmUomRule,
  learnConfirmedOrder,
  loadConfirmedQtyRules,
  loadOriginalQtyOnConvert,
  setOriginalQtyOnConvert,
};
