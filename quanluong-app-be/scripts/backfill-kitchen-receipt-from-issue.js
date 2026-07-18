#!/usr/bin/env node
/**
 * Backfill phiếu nhập kho bếp ăn (dòng on_guarantee) từ toàn bộ phiếu xuất LTTP.
 *
 * Gom theo (recipientUnitId, issueDate) — mỗi cặp → tối đa 1 KitchenReceiptSlip,
 * dùng syncKitchenReceiptOnGuaranteeFromIssueSlips (idempotent: chạy lại an toàn).
 *
 * Chạy local:
 *   node scripts/backfill-kitchen-receipt-from-issue.js
 *   node scripts/backfill-kitchen-receipt-from-issue.js --dry-run
 *   node scripts/backfill-kitchen-receipt-from-issue.js --user-id=1
 *
 * Docker / production:
 *   Chạy tự động sau migrate trong service `migrate`
 *   (scripts/prisma-migrate-deploy-recover.sh → npm run db:backfill-kitchen-receipt-from-issue).
 * Thủ công:
 *   docker compose exec quanluong-app-be npm run db:backfill-kitchen-receipt-from-issue
 */
import "dotenv/config";
import { prisma } from "../src/infra/database/prisma/prisma.client.js";
import { syncKitchenReceiptOnGuaranteeFromIssueSlips } from "../src/modules/kitchen-books/kitchen-books-receipt-sync.service.js";

function parseArgs(argv) {
  const opts = { dryRun: false, userId: null, limit: null };
  for (const raw of argv) {
    if (raw === "--dry-run") opts.dryRun = true;
    else if (raw.startsWith("--user-id=")) {
      const n = Number(raw.slice("--user-id=".length));
      opts.userId = Number.isInteger(n) && n > 0 ? n : null;
    } else if (raw.startsWith("--limit=")) {
      const n = Number(raw.slice("--limit=".length));
      opts.limit = Number.isInteger(n) && n > 0 ? n : null;
    }
  }
  return opts;
}

function ymdFromDate(d) {
  if (d instanceof Date) {
    return d.toISOString().slice(0, 10);
  }
  return String(d).slice(0, 10);
}

async function resolveActorUserId(explicitUserId) {
  if (explicitUserId != null) {
    const u = await prisma.user.findUnique({
      where: { id: explicitUserId },
      select: { id: true },
    });
    if (!u) {
      throw new Error(`Không tìm thấy user id=${explicitUserId}`);
    }
    return u.id;
  }

  const fromSlip = await prisma.lttpIssueSlip.findFirst({
    orderBy: { id: "asc" },
    select: { createdById: true },
  });
  if (fromSlip?.createdById) {
    return fromSlip.createdById;
  }

  const anyUser = await prisma.user.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!anyUser) {
    throw new Error("Không có user nào trong DB để gán createdById phiếu nhập.");
  }
  return anyUser.id;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const pairs = await prisma.lttpIssueSlip.groupBy({
    by: ["recipientUnitId", "issueDate"],
    _min: { createdById: true },
    _count: { id: true },
    orderBy: [{ issueDate: "asc" }, { recipientUnitId: "asc" }],
  });

  const work = opts.limit != null ? pairs.slice(0, opts.limit) : pairs;
  const fallbackActorId = await resolveActorUserId(opts.userId);

  console.log(
    `[backfill-kitchen-receipt] ${work.length}/${pairs.length} cặp (recipientUnitId, issueDate); actorUserId=${fallbackActorId}${opts.dryRun ? " (dry-run)" : ""}`,
  );

  if (!work.length) {
    console.log("[backfill-kitchen-receipt] Không có phiếu xuất LTTP — bỏ qua.");
    return;
  }

  if (opts.dryRun) {
    for (const p of work.slice(0, 20)) {
      console.log(
        `  - unit=${p.recipientUnitId} date=${ymdFromDate(p.issueDate)} slips=${p._count.id} createdBy~=${p._min.createdById}`,
      );
    }
    if (work.length > 20) {
      console.log(`  … và ${work.length - 20} cặp khác`);
    }
    return;
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of work) {
    const dateYmd = ymdFromDate(p.issueDate);
    const actorUserId = opts.userId ?? p._min.createdById ?? fallbackActorId;
    try {
      const r = await syncKitchenReceiptOnGuaranteeFromIssueSlips({
        recipientUnitId: p.recipientUnitId,
        dateYmd,
        actorUserId,
      });
      if (r?.ok) {
        ok += 1;
        console.log(
          `  ok unit=${p.recipientUnitId} date=${dateYmd} slipId=${r.slipId} onGuarantee=${r.onGuaranteeCount}`,
        );
      } else {
        skipped += 1;
        console.log(
          `  skip unit=${p.recipientUnitId} date=${dateYmd} reason=${r?.reason ?? "unknown"}`,
        );
      }
    } catch (err) {
      failed += 1;
      console.error(
        `  fail unit=${p.recipientUnitId} date=${dateYmd}:`,
        err?.message || err,
      );
    }
  }

  console.log(
    `[backfill-kitchen-receipt] xong: ok=${ok} skipped=${skipped} failed=${failed}`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
