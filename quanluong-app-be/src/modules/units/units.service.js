import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { listPrivateDataKindCodes } from "../../shared/data-scope/data-scope.registry.js";
import {
  UNIT_SCOPE_MODES,
  afterUnitTreeMutation,
  assertTargetUnitIsStrictDescendantOf,
  assertUnitIdInScope,
  getSubtreeUnitIds,
  unitTableIdWhereClause,
} from "../../shared/units/unit-scope.service.js";
import { UNITS_MAX_TREE_DEPTH } from "./units.constants.js";

const ALLOWED_PRIVATE_KINDS = new Set(listPrivateDataKindCodes());

function assertUnitInEffectiveBranch(unitId, effectiveUnitIds) {
  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    !effectiveUnitIds.includes(unitId)
  ) {
    throw new AppError({
      message: "Đơn vị ngoài nhánh đang chọn (X-Target-Unit-Id).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}

async function assertRecordBelongsToOwner(dataKind, recordId, ownerUnitId) {
  if (recordId == null) {
    return;
  }
  if (dataKind === "LTTP_COMMODITY") {
    const row = await prisma.lttpCommodity.findFirst({
      where: { id: recordId, unitId: ownerUnitId },
    });
    if (!row) {
      throw new AppError({
        message: "Bản ghi mặt hàng không thuộc đơn vị chủ hoặc không tồn tại",
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return;
  }
  if (dataKind === "LTTP_PRICE_TABLE") {
    const row = await prisma.lttpPriceTable.findFirst({
      where: { id: recordId, unitId: ownerUnitId },
    });
    if (!row) {
      throw new AppError({
        message: "Bản ghi bảng giá không thuộc đơn vị chủ hoặc không tồn tại",
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return;
  }
  if (dataKind === "JOB_TITLE") {
    const row = await prisma.jobTitle.findFirst({
      where: { id: recordId, unitId: ownerUnitId },
    });
    if (!row) {
      throw new AppError({
        message: "Chức danh không thuộc đơn vị chủ hoặc không tồn tại",
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
  }
}

function mapPrivateDataShareGrant(row) {
  return {
    id: row.id,
    ownerUnitId: row.ownerUnitId,
    consumerUnitId: row.consumerUnitId,
    consumerUnitName: row.consumerUnit?.name ?? null,
    dataKind: row.dataKind,
    recordId: row.recordId,
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo ? row.validTo.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function listPrivateDataShares(ownerUnitId, scope, effectiveUnitIds) {
  assertUnitIdInScope(ownerUnitId, scope);
  assertUnitInEffectiveBranch(ownerUnitId, effectiveUnitIds);
  const rows = await prisma.unitPrivateDataShareGrant.findMany({
    where: { ownerUnitId },
    orderBy: [{ id: "desc" }],
    include: {
      consumerUnit: { select: { id: true, name: true } },
    },
  });
  return rows.map(mapPrivateDataShareGrant);
}

async function createPrivateDataShares(payload, scope, effectiveUnitIds) {
  const { ownerUnitId, consumerUnitIds, dataKind, recordId, validFrom } = payload;
  if (!ALLOWED_PRIVATE_KINDS.has(dataKind)) {
    throw new AppError({
      message: `dataKind không hợp lệ — chỉ hỗ trợ: ${[...ALLOWED_PRIVATE_KINDS].join(", ")}`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  assertUnitIdInScope(ownerUnitId, scope);
  assertUnitInEffectiveBranch(ownerUnitId, effectiveUnitIds);
  await assertRecordBelongsToOwner(dataKind, recordId ?? null, ownerUnitId);

  const uniqueConsumers = [...new Set(consumerUnitIds.map(Number))];
  for (const consumerUnitId of uniqueConsumers) {
    assertUnitIdInScope(consumerUnitId, scope);
    assertUnitInEffectiveBranch(consumerUnitId, effectiveUnitIds);
    await assertTargetUnitIsStrictDescendantOf(consumerUnitId, ownerUnitId);
  }

  const start =
    validFrom instanceof Date && !Number.isNaN(validFrom.getTime()) ? validFrom : new Date();
  const rid = recordId ?? null;

  await prisma.$transaction(async (tx) => {
    for (const consumerUnitId of uniqueConsumers) {
      await tx.unitPrivateDataShareGrant.updateMany({
        where: {
          ownerUnitId,
          consumerUnitId,
          dataKind,
          recordId: rid,
          validTo: null,
        },
        data: { validTo: start },
      });
      await tx.unitPrivateDataShareGrant.create({
        data: {
          ownerUnitId,
          consumerUnitId,
          dataKind,
          recordId: rid,
          validFrom: start,
          validTo: null,
        },
      });
    }
  });

  return listPrivateDataShares(ownerUnitId, scope, effectiveUnitIds);
}

async function revokePrivateDataShare(grantId, scope, effectiveUnitIds) {
  const grant = await prisma.unitPrivateDataShareGrant.findFirst({
    where: { id: grantId },
    include: { consumerUnit: { select: { id: true, name: true } } },
  });
  if (!grant) {
    throw new AppError({
      message: "Không tìm thấy gán chia sẻ",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertUnitIdInScope(grant.ownerUnitId, scope);
  assertUnitInEffectiveBranch(grant.ownerUnitId, effectiveUnitIds);
  if (grant.validTo != null) {
    return mapPrivateDataShareGrant(grant);
  }
  const updated = await prisma.unitPrivateDataShareGrant.update({
    where: { id: grantId },
    data: { validTo: new Date() },
    include: { consumerUnit: { select: { id: true, name: true } } },
  });
  return mapPrivateDataShareGrant(updated);
}

const UNIT_LIST_INCLUDE = {
  _count: {
    select: {
      users: { where: { deletedAt: null } },
      children: true,
    },
  },
};

async function assertNoParentCycle(unitId, newParentId) {
  if (newParentId == null) {
    return;
  }
  if (newParentId === unitId) {
    throw new AppError({
      message: "A unit cannot be its own parent",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const descendants = await getSubtreeUnitIds(unitId);
  if (descendants.includes(newParentId)) {
    throw new AppError({
      message: "Cannot move a unit under one of its descendants",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function assertDepthAllowsChild(parentId) {
  if (parentId == null) {
    return;
  }
  const parent = await prisma.unit.findUnique({ where: { id: parentId } });
  if (!parent) {
    throw new AppError({
      message: "Parent unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (parent.depth >= UNITS_MAX_TREE_DEPTH - 1) {
    throw new AppError({
      message: `Max unit depth is ${UNITS_MAX_TREE_DEPTH} levels`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function assertReparentDepthOk(unitId, newParentId) {
  if (newParentId == null) {
    return;
  }
  const parent = await prisma.unit.findUnique({ where: { id: newParentId } });
  if (!parent) {
    throw new AppError({
      message: "Parent unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { depth: true, path: true },
  });
  if (!unit?.path) {
    return;
  }
  const prefix = unit.path.endsWith("/") ? unit.path : `${unit.path}/`;
  const subtree = await prisma.unit.findMany({
    where: {
      OR: [{ id: unitId }, { path: { startsWith: prefix } }],
    },
    select: { depth: true },
  });
  const maxDepth = Math.max(...subtree.map((u) => u.depth), unit.depth);
  const height = maxDepth - unit.depth;
  const maxDepthIndex = UNITS_MAX_TREE_DEPTH - 1;
  if (parent.depth + 1 + height > maxDepthIndex) {
    throw new AppError({
      message: `Reparent would exceed max depth (${UNITS_MAX_TREE_DEPTH} levels)`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function listUnits(scope, effectiveUnitIds) {
  return prisma.unit.findMany({
    where: unitTableIdWhereClause(scope, effectiveUnitIds),
    include: UNIT_LIST_INCLUDE,
    orderBy: [{ depth: "asc" }, { name: "asc" }],
  });
}

async function getUnitById(unitId, scope, effectiveUnitIds) {
  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      ...unitTableIdWhereClause(scope, effectiveUnitIds),
    },
    include: UNIT_LIST_INCLUDE,
  });

  if (!unit) {
    throw new AppError({
      message: "Unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  return unit;
}

function assertParentInEffectiveBranch(parentId, effectiveUnitIds) {
  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    parentId != null &&
    !effectiveUnitIds.includes(parentId)
  ) {
    throw new AppError({
      message: "Đơn vị cha ngoài nhánh đang chọn (kiểm tra X-Target-Unit-Id).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}

async function createUnit(payload, scope, effectiveUnitIds) {
  if (payload.parentId == null) {
    if (scope?.mode !== UNIT_SCOPE_MODES.ALL) {
      throw new AppError({
        message: "Only system scope can create root units",
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
      });
    }
    if (effectiveUnitIds != null && effectiveUnitIds.length > 0) {
      throw new AppError({
        message: "Cannot create root unit while scoped to a branch",
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
      });
    }
  } else {
    assertUnitIdInScope(payload.parentId, scope);
    assertParentInEffectiveBranch(payload.parentId, effectiveUnitIds);
  }

  await assertDepthAllowsChild(payload.parentId ?? null);

  try {
    const unit = await prisma.unit.create({
      data: {
        name: payload.name,
        description: payload.description ?? null,
        parentId: payload.parentId ?? null,
        isActive: payload.isActive ?? true,
      },
    });

    await afterUnitTreeMutation();

    return getUnitById(unit.id, scope, effectiveUnitIds);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError({
        message: "A unit with this name already exists",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
}

async function patchUnit(unitId, payload, scope, effectiveUnitIds) {
  await getUnitById(unitId, scope, effectiveUnitIds);

  const nextParentId = Object.hasOwn(payload, "parentId")
    ? (payload.parentId ?? null)
    : undefined;

  if (nextParentId !== undefined) {
    if (nextParentId === null) {
      if (scope?.mode !== UNIT_SCOPE_MODES.ALL) {
        throw new AppError({
          message: "Only system scope can set a unit as root",
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
        });
      }
      if (effectiveUnitIds != null && effectiveUnitIds.length > 0) {
        throw new AppError({
          message: "Cannot set unit as root while scoped to a branch",
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
        });
      }
    } else {
      assertUnitIdInScope(nextParentId, scope);
      assertParentInEffectiveBranch(nextParentId, effectiveUnitIds);
    }
    await assertNoParentCycle(unitId, nextParentId);
    await assertReparentDepthOk(unitId, nextParentId);
  }

  if (payload.isActive === false) {
    const [userCount, childCount] = await Promise.all([
      prisma.user.count({
        where: { unitId, deletedAt: null },
      }),
      prisma.unit.count({
        where: { parentId: unitId },
      }),
    ]);
    if (userCount > 0) {
      throw new AppError({
        message: "Cannot deactivate a unit that still has users",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    if (childCount > 0) {
      throw new AppError({
        message: "Cannot deactivate a unit that still has child units",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
  }

  const data = {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(nextParentId !== undefined ? { parentId: nextParentId } : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
  };

  if (!Object.keys(data).length) {
    return getUnitById(unitId, scope, effectiveUnitIds);
  }

  try {
    await prisma.unit.update({
      where: { id: unitId },
      data,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError({
        message: "A unit with this name already exists",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }

  await afterUnitTreeMutation();

  return getUnitById(unitId, scope, effectiveUnitIds);
}

async function deleteUnit(unitId, scope, effectiveUnitIds) {
  const unit = await getUnitById(unitId, scope, effectiveUnitIds);
  const userCount = await prisma.user.count({
    where: { unitId, deletedAt: null },
  });

  if (userCount > 0) {
    throw new AppError({
      message: "Cannot delete a unit that still has users",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.unit.updateMany({
      where: { parentId: unitId },
      data: { parentId: unit.parentId ?? null },
    });

    await tx.unit.delete({
      where: { id: unitId },
    });
  });

  await afterUnitTreeMutation();

  return { id: unitId };
}

export {
  createPrivateDataShares,
  createUnit,
  deleteUnit,
  getUnitById,
  listPrivateDataShares,
  listUnits,
  patchUnit,
  revokePrivateDataShare,
};
