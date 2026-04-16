import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { invalidateUnitLevelCapCache } from "../../shared/permissions/unit-level-cap.service.js";

async function listPermissionCatalog() {
  return prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      module: true,
      description: true,
    },
  });
}

async function collectDepthSet() {
  const depthSet = new Set();
  for (let d = 0; d <= 5; d += 1) {
    depthSet.add(d);
  }

  const fromUnits = await prisma.unit.findMany({
    distinct: ["depth"],
    select: { depth: true },
  });
  for (const row of fromUnits) {
    depthSet.add(row.depth);
  }

  const fromCaps = await prisma.unitLevelPermissionCap.findMany({
    distinct: ["depth"],
    select: { depth: true },
  });
  for (const row of fromCaps) {
    depthSet.add(row.depth);
  }

  const fromMeta = await prisma.unitLevelMetadata.findMany({
    select: { depth: true },
  });
  for (const row of fromMeta) {
    depthSet.add(row.depth);
  }

  return depthSet;
}

async function listUnitLevelPermissionCapsMatrix() {
  const [permissions, metaRows, depthSet] = await Promise.all([
    listPermissionCatalog(),
    prisma.unitLevelMetadata.findMany(),
    collectDepthSet(),
  ]);

  const metaByDepth = new Map(metaRows.map((m) => [m.depth, m]));

  const capRows = await prisma.unitLevelPermissionCap.findMany({
    select: { depth: true, permissionId: true },
  });
  const idsByDepth = new Map();
  for (const row of capRows) {
    if (!idsByDepth.has(row.depth)) {
      idsByDepth.set(row.depth, []);
    }
    idsByDepth.get(row.depth).push(row.permissionId);
  }

  const depths = [...depthSet].sort((a, b) => a - b);
  const depthPayloads = depths.map((depth) => ({
    depth,
    label: metaByDepth.get(depth)?.label ?? null,
    permissionIds: idsByDepth.get(depth) ?? [],
  }));

  return { depths: depthPayloads, permissions };
}

async function getUnitLevelPermissionCapsByDepth(depth) {
  const meta = await prisma.unitLevelMetadata.findUnique({
    where: { depth },
  });
  const permissionIds = (
    await prisma.unitLevelPermissionCap.findMany({
      where: { depth },
      select: { permissionId: true },
    })
  ).map((r) => r.permissionId);

  return {
    depth,
    label: meta?.label ?? null,
    permissionIds,
  };
}

async function replaceUnitLevelPermissionCapsForDepth(depth, permissionIds) {
  const uniqueIds = [...new Set(permissionIds)];
  if (uniqueIds.length) {
    const found = await prisma.permission.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (found.length !== uniqueIds.length) {
      throw new AppError({
        message: "One or more permission ids are invalid",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.unitLevelPermissionCap.deleteMany({ where: { depth } });
    if (uniqueIds.length) {
      await tx.unitLevelPermissionCap.createMany({
        data: uniqueIds.map((permissionId) => ({ depth, permissionId })),
      });
    }
  });

  invalidateUnitLevelCapCache(depth);
  return getUnitLevelPermissionCapsByDepth(depth);
}

export {
  getUnitLevelPermissionCapsByDepth,
  listUnitLevelPermissionCapsMatrix,
  replaceUnitLevelPermissionCapsForDepth,
};
