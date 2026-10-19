import { basePrisma } from "../database/prisma/prisma.client.js";

/** Thời hạn lưu (ngày) theo quyết định chủ sở hữu. */
const RETENTION_DAYS = {
  authEventLog: 365,
  dataChangeLog: 730,
  usageEvent: 90,
  usageSessionDaily: 730,
};
const BATCH = 5000;

async function deleteOlder(client, delegate, field, cutoff) {
  let total = 0;
  for (;;) {
    const rows = await client[delegate].findMany({
      where: { [field]: { lt: cutoff } },
      select: delegate === "usageSessionDaily" ? { userId: true, day: true } : { id: true },
      take: BATCH,
    });
    if (!rows.length) break;
    const where = delegate === "usageSessionDaily"
      ? { OR: rows.map((r) => ({ userId: r.userId, day: r.day })) }
      : { id: { in: rows.map((r) => r.id) } };
    const { count } = await client[delegate].deleteMany({ where });
    total += count;
    if (rows.length < BATCH) break;
  }
  return total;
}

/** Xóa nhật ký quá hạn theo lô (dùng client gốc — thao tác dọn không bị ghi nhật ký). */
async function cleanupAuditLogs({ now = new Date(), client = basePrisma } = {}) {
  const cut = (days) => new Date(now.getTime() - days * 86400000);
  return {
    auth: await deleteOlder(client, "authEventLog", "occurredAt", cut(RETENTION_DAYS.authEventLog)),
    changes: await deleteOlder(client, "dataChangeLog", "occurredAt", cut(RETENTION_DAYS.dataChangeLog)),
    usage: await deleteOlder(client, "usageEvent", "occurredAt", cut(RETENTION_DAYS.usageEvent)),
    usageDaily: await deleteOlder(client, "usageSessionDaily", "day", cut(RETENTION_DAYS.usageSessionDaily)),
  };
}

const AUDIT_RETENTION_SCHEDULE = "40 2 * * *";

export { AUDIT_RETENTION_SCHEDULE, cleanupAuditLogs, RETENTION_DAYS };
