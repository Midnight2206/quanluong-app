import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { UNIT_ENTITY_FORK_KIND } from "../../shared/unit-data-fork/unit-entity-fork.kinds.js";
import {
  assertTargetUnitIsStrictDescendantOf,
  assertUnitIdInScope,
  entityUnitIdWhere,
  UNIT_SCOPE_MODES,
} from "../../shared/units/unit-scope.service.js";

const JOB_TITLE_INCLUDE = {
  permissions: {
    select: { permissionId: true },
  },
};

function assertActorMayAssignPermissions(actor, permissionRecords) {
  const allowed = new Set((actor?.permissions || []).map((p) => p.code));
  for (const perm of permissionRecords) {
    if (!allowed.has(perm.code)) {
      throw new AppError({
        message: `You cannot grant permission ${perm.code}`,
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
      });
    }
  }
}

async function listJobTitles(scope, effectiveUnitIds) {
  return prisma.jobTitle.findMany({
    where: {
      ...entityUnitIdWhere(scope, effectiveUnitIds),
    },
    include: JOB_TITLE_INCLUDE,
    orderBy: [{ unitId: "asc" }, { name: "asc" }],
  });
}

async function getJobTitleById(jobTitleId, scope, effectiveUnitIds) {
  const row = await prisma.jobTitle.findFirst({
    where: {
      id: jobTitleId,
      ...entityUnitIdWhere(scope, effectiveUnitIds),
    },
    include: JOB_TITLE_INCLUDE,
  });

  if (!row) {
    throw new AppError({
      message: "Job title was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  return row;
}

async function createJobTitle(payload, scope, effectiveUnitIds) {
  assertUnitIdInScope(payload.unitId, scope);
  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    payload.unitId != null &&
    !effectiveUnitIds.includes(payload.unitId)
  ) {
    throw new AppError({
      message: "Đơn vị chức danh ngoài nhánh đang chọn (kiểm tra X-Target-Unit-Id).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
  try {
    const row = await prisma.jobTitle.create({
      data: {
        unitId: payload.unitId,
        name: payload.name,
        description: payload.description ?? null,
        isActive: payload.isActive ?? true,
      },
      include: JOB_TITLE_INCLUDE,
    });
    return row;
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError({
        message: "A job title with this name already exists in the unit",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
}

async function patchJobTitle(jobTitleId, payload, scope, effectiveUnitIds) {
  await getJobTitleById(jobTitleId, scope, effectiveUnitIds);

  const data = {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
  };

  if (!Object.keys(data).length) {
    return getJobTitleById(jobTitleId, scope, effectiveUnitIds);
  }

  try {
    await prisma.jobTitle.update({
      where: { id: jobTitleId },
      data,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError({
        message: "A job title with this name already exists in the unit",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }

  return getJobTitleById(jobTitleId, scope, effectiveUnitIds);
}

async function deactivateJobTitle(jobTitleId, scope, effectiveUnitIds) {
  await getJobTitleById(jobTitleId, scope, effectiveUnitIds);
  const inUse = await prisma.user.count({
    where: { jobTitleId, deletedAt: null },
  });
  if (inUse > 0) {
    throw new AppError({
      message: "Cannot deactivate a job title that is still assigned to users",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }

  await prisma.jobTitle.update({
    where: { id: jobTitleId },
    data: { isActive: false },
  });

  return getJobTitleById(jobTitleId, scope, effectiveUnitIds);
}

async function replaceJobTitlePermissionRows(tx, jobTitleId, permissionIds) {
  await tx.jobTitlePermission.deleteMany({ where: { jobTitleId } });
  if (permissionIds.length) {
    await tx.jobTitlePermission.createMany({
      data: permissionIds.map((permissionId) => ({ jobTitleId, permissionId })),
    });
  }
}

async function assertPermissionsAssignable(permissionIds, actor, scope) {
  if (!permissionIds.length) {
    return;
  }
  const perms = await prisma.permission.findMany({
    where: { id: { in: permissionIds } },
  });
  if (perms.length !== permissionIds.length) {
    throw new AppError({
      message: "One or more permissions were not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (scope?.mode !== UNIT_SCOPE_MODES.ALL) {
    assertActorMayAssignPermissions(actor, perms);
  }
}

async function applyJobTitleToDescendantUnit(
  sourceJobTitleId,
  targetUnitId,
  actor,
  scope,
  effectiveUnitIds,
) {
  const source = await prisma.jobTitle.findFirst({
    where: {
      id: sourceJobTitleId,
      ...entityUnitIdWhere(scope, effectiveUnitIds),
    },
    include: JOB_TITLE_INCLUDE,
  });

  if (!source) {
    throw new AppError({
      message: "Job title was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  assertUnitIdInScope(targetUnitId, scope);
  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    targetUnitId != null &&
    !effectiveUnitIds.includes(targetUnitId)
  ) {
    throw new AppError({
      message: "Đơn vị đích ngoài nhánh đang chọn (kiểm tra X-Target-Unit-Id).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  await assertTargetUnitIsStrictDescendantOf(targetUnitId, source.unitId);

  const permissionIds = [...new Set((source.permissions || []).map((p) => p.permissionId))];
  await assertPermissionsAssignable(permissionIds, actor, scope);

  return prisma.$transaction(async (tx) => {
    let existing = await tx.unitEntityFork.findUnique({
      where: {
        kind_sourceRecordId_targetUnitId: {
          kind: UNIT_ENTITY_FORK_KIND.JOB_TITLE,
          sourceRecordId: sourceJobTitleId,
          targetUnitId,
        },
      },
    });

    if (existing) {
      const targetRow = await tx.jobTitle.findFirst({
        where: { id: existing.targetRecordId, unitId: targetUnitId },
        include: JOB_TITLE_INCLUDE,
      });
      if (!targetRow) {
        await tx.unitEntityFork.delete({ where: { id: existing.id } });
        existing = null;
      } else {
        await tx.jobTitle.update({
          where: { id: targetRow.id },
          data: {
            name: source.name,
            description: source.description ?? null,
            isActive: source.isActive,
          },
        });
        await replaceJobTitlePermissionRows(tx, targetRow.id, permissionIds);
        await tx.unitEntityFork.update({
          where: { id: existing.id },
          data: { appliedByUserId: actor?.id ?? null },
        });
        return tx.jobTitle.findFirst({
          where: { id: targetRow.id },
          include: JOB_TITLE_INCLUDE,
        });
      }
    }

    let created;
    try {
      created = await tx.jobTitle.create({
        data: {
          unitId: targetUnitId,
          name: source.name,
          description: source.description ?? null,
          isActive: source.isActive,
        },
      });
    } catch (error) {
      if (error.code === "P2002") {
        throw new AppError({
          message:
            "Đơn vị đích đã có chức danh trùng tên — đổi tên bản nguồn hoặc xóa/đổi chức danh trùng ở đơn vị con rồi thử lại.",
          statusCode: 409,
          code: ERROR_CODES.CONFLICT,
        });
      }
      throw error;
    }

    await replaceJobTitlePermissionRows(tx, created.id, permissionIds);

    await tx.unitEntityFork.create({
      data: {
        kind: UNIT_ENTITY_FORK_KIND.JOB_TITLE,
        sourceRecordId: sourceJobTitleId,
        sourceUnitId: source.unitId,
        targetUnitId,
        targetRecordId: created.id,
        appliedByUserId: actor?.id ?? null,
      },
    });

    return tx.jobTitle.findFirst({
      where: { id: created.id },
      include: JOB_TITLE_INCLUDE,
    });
  });
}

async function setJobTitlePermissions(jobTitleId, permissionIds, actor, scope, effectiveUnitIds) {
  await getJobTitleById(jobTitleId, scope, effectiveUnitIds);

  if (!permissionIds.length) {
    await prisma.jobTitlePermission.deleteMany({ where: { jobTitleId } });
    return getJobTitleById(jobTitleId, scope, effectiveUnitIds);
  }

  const perms = await prisma.permission.findMany({
    where: { id: { in: permissionIds } },
  });

  if (perms.length !== permissionIds.length) {
    throw new AppError({
      message: "One or more permissions were not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  if (scope?.mode !== UNIT_SCOPE_MODES.ALL) {
    assertActorMayAssignPermissions(actor, perms);
  }

  await prisma.$transaction([
    prisma.jobTitlePermission.deleteMany({ where: { jobTitleId } }),
    prisma.jobTitlePermission.createMany({
      data: permissionIds.map((permissionId) => ({ jobTitleId, permissionId })),
    }),
  ]);

  return getJobTitleById(jobTitleId, scope, effectiveUnitIds);
}

export {
  applyJobTitleToDescendantUnit,
  createJobTitle,
  deactivateJobTitle,
  getJobTitleById,
  listJobTitles,
  patchJobTitle,
  setJobTitlePermissions,
};
