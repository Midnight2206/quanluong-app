import { basePrisma } from "../database/prisma/prisma.client.js";

const toDate = (v) => (v ? new Date(v) : new Date());

/**
 * Ghi một lô nhật ký (dùng client gốc — không đi qua extension audit để tránh vòng lặp).
 * @param {{ auth?: object[], changes?: object[], usage?: object[], heartbeats?: object[] }} batch
 */
async function persistAuditBatch(batch, client = basePrisma) {
  const { auth = [], changes = [], usage = [], heartbeats = [] } = batch || {};
  if (auth.length && client.authEventLog) {
    await client.authEventLog.createMany({
      data: auth.map((e) => ({ ...e, occurredAt: toDate(e.occurredAt) })),
    });
  }
  if (changes.length && client.dataChangeLog) {
    await client.dataChangeLog.createMany({
      data: changes.map((e) => ({ ...e, occurredAt: toDate(e.occurredAt) })),
    });
  }
  if (usage.length && client.usageEvent) {
    await client.usageEvent.createMany({
      data: usage.map((e) => ({ ...e, occurredAt: toDate(e.occurredAt) })),
    });
  }
  if (heartbeats.length && client.usageSessionDaily) {
    await applyUsageDaily(heartbeats, client);
  }
}

/** heartbeats: [{ userId, unitId, day:'YYYY-MM-DD', activeSec, pageViews, at }] — gộp rồi upsert. */
async function applyUsageDaily(heartbeats, client) {
  const byKey = new Map();
  for (const h of heartbeats) {
    const source = h.source || "web";
    const k = `${h.userId}|${h.day}|${source}`;
    const cur = byKey.get(k) ?? { userId: h.userId, unitId: h.unitId ?? null, day: h.day, source, activeSec: 0, pageViews: 0, first: h.at, last: h.at };
    cur.activeSec += h.activeSec || 0;
    cur.pageViews += h.pageViews || 0;
    if (h.at < cur.first) cur.first = h.at;
    if (h.at > cur.last) cur.last = h.at;
    byKey.set(k, cur);
  }
  for (const r of byKey.values()) {
    const day = new Date(`${r.day}T00:00:00.000Z`);
    await client.usageSessionDaily.upsert({
      where: { userId_day_source: { userId: r.userId, day, source: r.source } },
      create: {
        userId: r.userId,
        day,
        source: r.source,
        unitId: r.unitId,
        activeSec: r.activeSec,
        pageViews: r.pageViews,
        firstSeenAt: toDate(r.first),
        lastSeenAt: toDate(r.last),
      },
      update: {
        activeSec: { increment: r.activeSec },
        pageViews: { increment: r.pageViews },
        lastSeenAt: toDate(r.last),
      },
    });
  }
}

export { persistAuditBatch };
