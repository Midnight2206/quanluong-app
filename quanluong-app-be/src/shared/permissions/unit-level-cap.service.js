import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { DEFAULT_ADMIN_PERMISSION_CODES } from "../constants/default-admin-permissions.js";

const depthToAllowedIdsCache = new Map();

async function fetchCapIdsFromDb(depth) {
  const rows = await prisma.unitLevelPermissionCap.findMany({
    where: { depth },
    select: { permissionId: true },
  });
  return new Set(rows.map((r) => r.permissionId));
}

/**
 * @param {number} depth
 * @returns {Promise<Set<number>>}
 */
async function getCapPermissionIdsForDepth(depth) {
  if (depthToAllowedIdsCache.has(depth)) {
    return depthToAllowedIdsCache.get(depth);
  }
  const set = await fetchCapIdsFromDb(depth);
  depthToAllowedIdsCache.set(depth, set);
  return set;
}

/**
 * @param {number} [depth] — omit to clear all
 */
function invalidateUnitLevelCapCache(depth) {
  if (depth === undefined) {
    depthToAllowedIdsCache.clear();
    return;
  }
  depthToAllowedIdsCache.delete(depth);
}

/**
 * Lần đầu (DB chưa có cap nào): seed đầy đủ theo DEFAULT_ADMIN cho depths 0..5 và mọi depth đang có trong Unit.
 * Depth mới (chưa có dòng cap): thêm mặc định DEFAULT_ADMIN.
 */
async function ensureUnitLevelPermissionCapsSeed() {
  const total = await prisma.unitLevelPermissionCap.count();
  const defaultRows = await prisma.permission.findMany({
    where: {
      code: { in: DEFAULT_ADMIN_PERMISSION_CODES },
    },
    select: { id: true },
  });
  const defaultIds = defaultRows.map((r) => r.id);
  if (!defaultIds.length) {
    return;
  }

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

  if (total === 0) {
    const data = [];
    for (const depth of depthSet) {
      for (const permissionId of defaultIds) {
        data.push({ depth, permissionId });
      }
    }
    await prisma.unitLevelPermissionCap.createMany({ data, skipDuplicates: true });
    depthToAllowedIdsCache.clear();
    return;
  }

  for (const depth of depthSet) {
    const existing = await prisma.unitLevelPermissionCap.findMany({
      where: { depth },
      select: { permissionId: true },
    });
    const have = new Set(existing.map((r) => r.permissionId));
    const missing = defaultIds.filter((id) => !have.has(id));
    if (missing.length > 0) {
      await prisma.unitLevelPermissionCap.createMany({
        data: missing.map((permissionId) => ({ depth, permissionId })),
        skipDuplicates: true,
      });
    }
  }
  depthToAllowedIdsCache.clear();
}

export {
  ensureUnitLevelPermissionCapsSeed,
  getCapPermissionIdsForDepth,
  invalidateUnitLevelCapCache,
};
