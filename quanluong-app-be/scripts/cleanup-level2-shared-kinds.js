/**
 * Flatten unit tree to max depth 1, then delete shared-kind data on depth >= 1 units.
 * Default: dry-run. Pass --execute to write.
 *
 * Usage:
 *   node scripts/cleanup-level2-shared-kinds.js
 *   node scripts/cleanup-level2-shared-kinds.js --execute
 */
import { prisma } from "../src/infra/database/prisma/prisma.client.js";
import { rebuildAllUnitPaths } from "../src/shared/units/unit-scope.service.js";

const EXECUTE = process.argv.includes("--execute");

const SHARED_FORK_KINDS = ["JOB_TITLE", "LTTP_COMMODITY", "LTTP_PRICE_TABLE"];

async function nearestLevel1Id(unit, byId) {
  let cur = unit;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.depth === 0) {
      return cur.id;
    }
    if (cur.parentId == null) {
      return cur.id;
    }
    cur = byId.get(cur.parentId);
  }
  return null;
}

async function main() {
  console.log(EXECUTE ? "MODE: EXECUTE" : "MODE: dry-run (pass --execute to write)");

  const units = await prisma.unit.findMany({
    select: { id: true, parentId: true, depth: true, name: true, path: true },
    orderBy: { id: "asc" },
  });
  const byId = new Map(units.map((u) => [u.id, u]));

  const deep = units.filter((u) => u.depth >= 2);
  console.log(`Units depth>=2 to flatten: ${deep.length}`);

  if (EXECUTE && deep.length) {
    for (const u of deep) {
      const level1 = await nearestLevel1Id(u, byId);
      if (level1 == null || level1 === u.id) {
        console.warn(`skip flatten unit ${u.id} (${u.name}) — no level-1 ancestor`);
        continue;
      }
      await prisma.unit.update({
        where: { id: u.id },
        data: { parentId: level1 },
      });
      console.log(`flatten unit ${u.id} -> parent ${level1}`);
    }
    await rebuildAllUnitPaths();
  }

  const after = await prisma.unit.findMany({
    select: { id: true, depth: true, name: true },
  });
  const childIds = after.filter((u) => u.depth >= 1).map((u) => u.id);
  console.log(`Child unit ids (depth>=1): ${childIds.length}`, childIds);

  const commodityIds = childIds.length
    ? (
        await prisma.lttpCommodity.findMany({
          where: { unitId: { in: childIds } },
          select: { id: true },
        })
      ).map((r) => r.id)
    : [];

  const counts = {
    jobTitles: childIds.length
      ? await prisma.jobTitle.count({ where: { unitId: { in: childIds } } })
      : 0,
    priceTables: childIds.length
      ? await prisma.lttpPriceTable.count({ where: { unitId: { in: childIds } } })
      : 0,
    commodities: commodityIds.length,
    forks: await prisma.unitEntityFork.count({
      where: {
        kind: { in: SHARED_FORK_KINDS },
        OR: [
          ...(childIds.length
            ? [{ sourceUnitId: { in: childIds } }, { targetUnitId: { in: childIds } }]
            : []),
        ],
      },
    }),
  };
  console.log("Planned deletes:", counts);

  const adminsOnChild = await prisma.user.findMany({
    where: {
      deletedAt: null,
      unitId: { in: childIds.length ? childIds : [-1] },
      type: { name: "admin" },
    },
    select: { id: true, username: true, unitId: true },
  });
  console.log(
    `Admin users still on depth>=1 (not auto-demoted): ${adminsOnChild.length}`,
    adminsOnChild,
  );

  if (!EXECUTE) {
    console.log("Dry-run done. No writes.");
    return;
  }

  if (!childIds.length) {
    console.log("No child units — nothing to delete.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.unitEntityFork.deleteMany({
      where: {
        kind: { in: SHARED_FORK_KINDS },
        OR: [{ sourceUnitId: { in: childIds } }, { targetUnitId: { in: childIds } }],
      },
    });

    await tx.unitPrivateDataShareGrant.deleteMany({
      where: {
        dataKind: { in: ["JOB_TITLE", "LTTP_COMMODITY", "LTTP_PRICE_TABLE"] },
        OR: [{ ownerUnitId: { in: childIds } }, { consumerUnitId: { in: childIds } }],
      },
    });

    await tx.user.updateMany({
      where: { jobTitle: { unitId: { in: childIds } } },
      data: { jobTitleId: null },
    });
    await tx.jobTitle.deleteMany({ where: { unitId: { in: childIds } } });

    await tx.lttpPriceTable.deleteMany({ where: { unitId: { in: childIds } } });

    if (commodityIds.length) {
      await tx.lttpIssueSlipLine.deleteMany({ where: { commodityId: { in: commodityIds } } });
      await tx.kitchenDishCatalogLine.deleteMany({
        where: { commodityId: { in: commodityIds } },
      });
      await tx.kitchenMenuDishLine.deleteMany({
        where: { commodityId: { in: commodityIds } },
      });
      await tx.kitchenReceiptSlipLine.deleteMany({
        where: { commodityId: { in: commodityIds } },
      });
      await tx.lttpPriceRow.deleteMany({ where: { commodityId: { in: commodityIds } } });
      await tx.lttpPartnerPriceRow.deleteMany({
        where: { commodityId: { in: commodityIds } },
      });
      await tx.lttpCommodity.deleteMany({ where: { id: { in: commodityIds } } });
    }
  });

  console.log("Cleanup executed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
