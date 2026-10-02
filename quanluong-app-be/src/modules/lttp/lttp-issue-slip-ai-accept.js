function applyScoreGate(decision, commodities, percent) {
  if (percent == null || !Number.isFinite(Number(percent))) return decision;
  const bar = Number(percent) / 100;
  const topChoice = (decision?.choices || [])[0] || null;
  const assigned = Number(decision?.commodityId) > 0;
  const commodityId = assigned ? Number(decision.commodityId) : Number(topChoice?.commodityId) || null;
  const confidence = assigned ? Number(decision.confidence) : Number(topChoice?.score ?? decision?.confidence);
  if (!(commodityId > 0) || !Number.isFinite(confidence)) {
    return { ...decision, commodityId: null, needsConfirm: true, needsLlm: false };
  }
  if (confidence > bar) {
    return {
      ...decision,
      commodityId,
      confidence,
      source: decision.source && decision.source !== "none" ? decision.source : "score",
      needsConfirm: false,
      needsLlm: false,
    };
  }
  const catalog = (commodities || []).find((row) => row.id === commodityId);
  const suggested = {
    commodityId,
    name: catalog?.name || topChoice?.name || "",
    code: catalog?.code ?? topChoice?.code ?? null,
    stat: topChoice?.stat || "",
    score: confidence,
  };
  const choices = [
    suggested,
    ...(decision.choices || []).filter((choice) => choice.commodityId !== commodityId),
  ].slice(0, 3);
  return {
    ...decision,
    commodityId: null,
    confidence,
    needsConfirm: true,
    needsLlm: false,
    choices,
  };
}

// ponytail: bậc cố định theo số mẫu đã học của danh mục kho. Đổi bậc khi có thước đo riêng cho từng kho.
const SAMPLE_BANDS = [
  { min: 1, from: 95, to: 100 },
  { min: 50, from: 90, to: 95 },
  { min: 150, from: 80, to: 90 },
  { min: 300, from: 70, to: 85 },
];

function suggestAcceptRange(sampleCount) {
  const samples = Math.max(0, Math.floor(Number(sampleCount) || 0));
  let picked = null;
  for (const band of SAMPLE_BANDS) {
    if (samples >= band.min) picked = band;
  }
  if (!picked) return { from: null, to: null, samples, ready: false };
  return { from: picked.from, to: picked.to, samples, ready: true };
}

function sampleTotal(aliases, habits) {
  const hits = (aliases || []).reduce((sum, row) => sum + (Number(row.hitCount) || 0), 0);
  const qty = (habits || []).reduce((sum, row) => {
    const listed = Array.isArray(row.qtySamples) ? row.qtySamples.length : 0;
    return sum + listed;
  }, 0);
  return hits + qty;
}

async function readAutoAcceptPercent(prisma, storageUnitId) {
  if (!prisma?.lttpUnitIssueFormDefaults?.findUnique || !storageUnitId) return null;
  const row = await prisma.lttpUnitIssueFormDefaults.findUnique({
    where: { unitId: storageUnitId },
    select: { aiAutoAcceptPercent: true },
  });
  return row?.aiAutoAcceptPercent == null ? 100 : Number(row.aiAutoAcceptPercent);
}

async function countLevel1AiSamples(prisma, storageUnitId) {
  if (!prisma?.lttpCommodity?.findMany || !storageUnitId) return 0;
  const commodities = await prisma.lttpCommodity.findMany({
    where: { unitId: storageUnitId, isActive: true },
    select: { id: true },
  });
  const ids = commodities.map((row) => row.id).filter((id) => Number(id) > 0);
  if (!ids.length) return 0;
  const [aliases, habits] = await Promise.all([
    prisma.lttpAiAliasStat?.findMany
      ? prisma.lttpAiAliasStat.findMany({
          where: { commodityId: { in: ids } },
          select: { hitCount: true },
        })
      : [],
    prisma.lttpAiCommodityHabit?.findMany
      ? prisma.lttpAiCommodityHabit.findMany({
          where: { commodityId: { in: ids } },
          select: { qtySamples: true },
        })
      : [],
  ]);
  return sampleTotal(aliases, habits);
}

async function loadAiAutoAccept(prisma, storageUnitId) {
  const percent = (await readAutoAcceptPercent(prisma, storageUnitId)) ?? 100;
  const samples = await countLevel1AiSamples(prisma, storageUnitId);
  return { percent, suggestion: suggestAcceptRange(samples) };
}

async function saveAiAutoAccept(prisma, storageUnitId, percent) {
  const stored = percent == null ? 100 : percent;
  await prisma.lttpUnitIssueFormDefaults.upsert({
    where: { unitId: storageUnitId },
    create: { unitId: storageUnitId, aiAutoAcceptPercent: stored },
    update: { aiAutoAcceptPercent: stored },
  });
  return loadAiAutoAccept(prisma, storageUnitId);
}

export {
  applyScoreGate,
  loadAiAutoAccept,
  readAutoAcceptPercent,
  sampleTotal,
  saveAiAutoAccept,
  suggestAcceptRange,
};
