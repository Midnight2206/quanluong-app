#!/usr/bin/env node
/**
 * @deprecated Dùng UI tab Nhập xuất LTTP → «Cài người mua theo đơn vị kho» → Lưu & áp dụng.
 *
 * Giữ lệnh cho ops nếu cần chạy ngoài UI (tương đương API applyToAllSlips=true).
 */
import "dotenv/config";
import { prisma } from "../src/infra/database/prisma/prisma.client.js";
import { putBuyerDefaultForUnit } from "../src/modules/lttp/lttp.service.js";

function parseArgs(argv) {
  const opts = { dryRun: false, unitId: null, userId: null };
  for (const raw of argv) {
    if (raw === "--dry-run") opts.dryRun = true;
    else if (raw.startsWith("--unit-id=")) opts.unitId = Number(raw.slice(10));
    else if (raw.startsWith("--user-id=")) opts.userId = Number(raw.slice(10));
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.unitId == null || opts.userId == null) {
    console.error("Cần --unit-id= và --user-id=. Khuyên dùng UI «Lưu & áp dụng».");
    process.exit(1);
  }
  if (opts.dryRun) {
    const count = await prisma.lttpIssueSlip.count({ where: { unitId: opts.unitId } });
    console.log(`[dry-run] Sẽ gán userId=${opts.userId} cho ${count} phiếu unitId=${opts.unitId}.`);
    return;
  }
  const unit = await prisma.unit.findUnique({ where: { id: opts.unitId }, select: { id: true } });
  if (!unit) {
    throw new Error(`Không tìm thấy unit id=${opts.unitId}`);
  }
  const data = await putBuyerDefaultForUnit(
    { unitId: opts.unitId, userId: opts.userId, applyToAllSlips: true },
    { mode: "ALL" },
    [opts.unitId],
    { storageUnitId: opts.unitId },
  );
  console.log(JSON.stringify(data, null, 2));
}

main()
  .catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
