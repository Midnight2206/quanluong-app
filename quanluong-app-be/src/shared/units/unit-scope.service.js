import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

const SYSTEM_TYPE_NAMES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  USER: "user",
};

const UNIT_SCOPE_MODES = {
  ALL: "all",
  SUBTREE: "subtree",
  EXACT: "exact",
};

const MAX_PATH_REBUILD_PASSES = 32;
const SAMPLE_CHILD_UNIT_NAME = "Đơn vị mẫu cấp 2";

function normalizePathPrefix(path) {
  if (!path) {
    return "";
  }
  return path.endsWith("/") ? path : `${path}/`;
}

function computePathAndDepth(unit, byId) {
  if (!unit.parentId) {
    return { path: `/${unit.id}/`, depth: 0 };
  }
  const parent = byId.get(unit.parentId);
  if (!parent?.path) {
    return { path: null, depth: null };
  }
  const base = normalizePathPrefix(parent.path);
  return { path: `${base}${unit.id}/`, depth: parent.depth + 1 };
}

/**
 * Refreshes `path` and `depth` for all units (safe for small/medium trees).
 * Call after any Unit parent change or new rows before `path` was set.
 */
async function rebuildAllUnitPaths() {
  for (let pass = 0; pass < MAX_PATH_REBUILD_PASSES; pass += 1) {
    const units = await prisma.unit.findMany({ orderBy: { id: "asc" } });
    const byId = new Map(units.map((u) => [u.id, u]));
    let anyUpdated = false;

    for (const unit of units) {
      const { path, depth } = computePathAndDepth(unit, byId);
      if (!path || depth === null) {
        continue;
      }
      if (unit.path !== path || unit.depth !== depth) {
        await prisma.unit.update({
          where: { id: unit.id },
          data: { path, depth },
        });
        anyUpdated = true;
      }
    }

    if (!anyUpdated) {
      break;
    }
  }
}

/**
 * Ensures at least one parent–child pair exists for demos (two-level sample).
 */
async function ensureSampleUnitHierarchy() {
  const childCount = await prisma.unit.count({
    where: { parentId: { not: null } },
  });
  if (childCount > 0) {
    return;
  }

  const root = await prisma.unit.findFirst({
    where: { parentId: null },
    orderBy: { id: "asc" },
  });

  if (!root) {
    return;
  }

  await prisma.unit.create({
    data: {
      name: SAMPLE_CHILD_UNIT_NAME,
      description: "Đơn vị con mẫu (hai cấp) — có thể xóa hoặc đổi sau.",
      parentId: root.id,
      isActive: true,
    },
  });
}

async function getSubtreeUnitIds(rootUnitId) {
  if (!rootUnitId) {
    return [];
  }

  const root = await prisma.unit.findUnique({
    where: { id: rootUnitId },
  });

  if (!root) {
    return [];
  }

  let pathPrefix = root.path;
  if (!pathPrefix) {
    await rebuildAllUnitPaths();
    const again = await prisma.unit.findUnique({ where: { id: rootUnitId } });
    pathPrefix = again?.path || `/${rootUnitId}/`;
  }

  const prefix = normalizePathPrefix(pathPrefix);
  const rows = await prisma.unit.findMany({
    where: {
      OR: [{ id: rootUnitId }, { path: { startsWith: prefix } }],
    },
    select: { id: true },
  });

  return [...new Set(rows.map((r) => r.id))];
}

async function getUnitBreadcrumbChain(unitId) {
  if (!unitId) {
    return [];
  }

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) {
    return [];
  }

  let segmentIds = unit.path?.split("/").filter(Boolean).map((s) => Number(s)) || [];

  if (!segmentIds.length) {
    await rebuildAllUnitPaths();
    const refreshed = await prisma.unit.findUnique({ where: { id: unitId } });
    segmentIds = refreshed?.path?.split("/").filter(Boolean).map((s) => Number(s)) || [];
    if (!segmentIds.length) {
      return [{ id: unit.id, name: unit.name }];
    }
  }

  const chainUnits = await prisma.unit.findMany({
    where: { id: { in: segmentIds } },
    select: { id: true, name: true },
  });
  const byId = new Map(chainUnits.map((u) => [u.id, u]));

  return segmentIds.map((id) => ({
    id,
    name: byId.get(id)?.name ?? "",
  }));
}

async function resolveUnitScopeForUser(user) {
  const typeName = user?.type?.name;

  if (typeName === SYSTEM_TYPE_NAMES.SUPERADMIN) {
    return { mode: UNIT_SCOPE_MODES.ALL, unitIds: null };
  }

  const unitId = user?.unitId;
  if (!unitId) {
    return { mode: UNIT_SCOPE_MODES.EXACT, unitIds: [] };
  }

  /** Cả admin và user thường: phạm vi đơn vị = gốc gán + mọi đơn vị con (nhánh path). Khớp LTTP/meal roster/X-Target branch. */
  const unitIds = await getSubtreeUnitIds(unitId);
  return { mode: UNIT_SCOPE_MODES.SUBTREE, unitIds };
}

function unitIdsWhereClause(scope) {
  if (!scope || scope.mode === UNIT_SCOPE_MODES.ALL) {
    return {};
  }
  if (!scope.unitIds?.length) {
    return { unitId: { in: [-1] } };
  }
  return { unitId: { in: scope.unitIds } };
}

/**
 * WHERE `unitId` (User, JobTitle, …) từ `req.effectiveUnitIds` sau middleware.
 * `undefined` → fallback `unitIdsWhereClause(scope)` (tương thích route chưa gắn middleware).
 */
function entityUnitIdWhere(scope, effectiveUnitIds) {
  if (effectiveUnitIds === undefined) {
    return unitIdsWhereClause(scope);
  }
  if (effectiveUnitIds === null) {
    return {};
  }
  if (!effectiveUnitIds.length) {
    return { unitId: { in: [-1] } };
  }
  return { unitId: { in: effectiveUnitIds } };
}

/** WHERE `id` bảng Unit. */
function unitTableIdWhereClause(scope, effectiveUnitIds) {
  if (effectiveUnitIds === undefined) {
    return unitRecordWhereClause(scope);
  }
  if (effectiveUnitIds === null) {
    return {};
  }
  if (!effectiveUnitIds.length) {
    return { id: { in: [-1] } };
  }
  return { id: { in: effectiveUnitIds } };
}

/** Filter `Unit` rows by the same scoped ids as `User.unitId` lists. */
function unitRecordWhereClause(scope) {
  if (!scope || scope.mode === UNIT_SCOPE_MODES.ALL) {
    return {};
  }
  if (!scope.unitIds?.length) {
    return { id: { in: [-1] } };
  }
  return { id: { in: scope.unitIds } };
}

function assertUnitIdInScope(unitId, scope, { allowNull = false } = {}) {
  if (!scope || scope.mode === UNIT_SCOPE_MODES.ALL) {
    return;
  }
  if (unitId == null) {
    if (allowNull) {
      return;
    }
    throw new AppError({
      message: "Unit is outside your scope",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
  if (!scope.unitIds?.includes(unitId)) {
    throw new AppError({
      message: "Unit is outside your scope",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}

/**
 * After any Unit CRUD that changes `parentId`, run this (or `rebuildAllUnitPaths`)
 * so materialized paths stay correct.
 */
async function afterUnitTreeMutation() {
  return rebuildAllUnitPaths();
}

/**
 * Đơn vị `descendantUnitId` phải là **cấp dưới thật** của `ancestorUnitId` (cùng nhánh path, khác id).
 */
async function assertTargetUnitIsStrictDescendantOf(descendantUnitId, ancestorUnitId) {
  if (descendantUnitId == null || ancestorUnitId == null) {
    throw new AppError({
      message: "Thiếu đơn vị nguồn hoặc đích",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (Number(descendantUnitId) === Number(ancestorUnitId)) {
    throw new AppError({
      message: "Chọn một đơn vị cấp dưới, không phải chính đơn vị đang giữ chức danh nguồn",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  let ancestor = await prisma.unit.findUnique({ where: { id: Number(ancestorUnitId) } });
  let descendant = await prisma.unit.findUnique({ where: { id: Number(descendantUnitId) } });

  if (!ancestor || !descendant) {
    throw new AppError({
      message: "Unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  if (!ancestor.path || !descendant.path) {
    await rebuildAllUnitPaths();
    ancestor = await prisma.unit.findUnique({ where: { id: Number(ancestorUnitId) } });
    descendant = await prisma.unit.findUnique({ where: { id: Number(descendantUnitId) } });
  }

  const pref = normalizePathPrefix(ancestor?.path || "");
  const dp = descendant?.path || "";

  if (!pref || !dp || !dp.startsWith(pref)) {
    throw new AppError({
      message: "Đơn vị đích phải thuộc nhánh con của đơn vị nguồn",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}

export {
  UNIT_SCOPE_MODES,
  afterUnitTreeMutation,
  assertTargetUnitIsStrictDescendantOf,
  assertUnitIdInScope,
  entityUnitIdWhere,
  ensureSampleUnitHierarchy,
  getSubtreeUnitIds,
  getUnitBreadcrumbChain,
  rebuildAllUnitPaths,
  resolveUnitScopeForUser,
  unitIdsWhereClause,
  unitRecordWhereClause,
  unitTableIdWhereClause,
};
