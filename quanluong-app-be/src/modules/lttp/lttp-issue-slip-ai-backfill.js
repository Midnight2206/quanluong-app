/**
 * Rebuild commodity habits from saved slips.
 * ponytail: slip lines have commodityId, not the typed name, so aliases stay on the live confirm path.
 * Nightly replace (not increment) so a confirm earlier the same day is not counted twice.
 */
async function rebuildCommodityHabits(prisma) {
  const lines = await prisma.lttpIssueSlipLine.findMany({
    select: {
      commodityId: true,
      quantity: true,
      slip: { select: { recipientUnitId: true, issueDate: true } },
      commodity: { select: { measureUnit: true } },
    },
  });
  const groups = new Map();
  for (const line of lines) {
    const recipientUnitId = line.slip?.recipientUnitId;
    if (!recipientUnitId) continue;
    const measureUnit = String(line.commodity?.measureUnit || ".").slice(0, 64);
    const key = `${recipientUnitId}|${line.commodityId}|${measureUnit}`;
    const bucket = groups.get(key) || {
      recipientUnitId,
      commodityId: line.commodityId,
      measureUnit,
      samples: [],
      last: null,
      count: 0,
    };
    bucket.count += 1;
    const qty = Number(line.quantity);
    const at = line.slip.issueDate ? new Date(line.slip.issueDate) : null;
    if (Number.isFinite(qty)) bucket.samples.push({ qty, at });
    if (at && (!bucket.last || at > bucket.last)) bucket.last = at;
    groups.set(key, bucket);
  }
  const data = [...groups.values()].map((bucket) => ({
    recipientUnitId: bucket.recipientUnitId,
    commodityId: bucket.commodityId,
    measureUnit: bucket.measureUnit,
    orderCount: bucket.count,
    lastOrderedAt: bucket.last,
    qtySamples: bucket.samples
      .sort((a, b) => (a.at || 0) - (b.at || 0))
      .slice(-100)
      .map((sample) => sample.qty),
  }));
  await prisma.$transaction([
    prisma.lttpAiCommodityHabit.deleteMany({}),
    ...(data.length ? [prisma.lttpAiCommodityHabit.createMany({ data })] : []),
  ]);
  return { groups: data.length };
}

export { rebuildCommodityHabits };
