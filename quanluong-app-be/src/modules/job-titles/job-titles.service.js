import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { assertLogicalUnitIsLevel1ForWrite } from "../../shared/units/unit-level.helpers.js";
import {
  assertUnitIdInScope,
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

function assertUnitInEffectiveBranch(unitId, effectiveUnitIds) {
  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    unitId != null &&
    !effectiveUnitIds.includes(unitId)
  ) {
    throw new AppError({
      message: "Đơn vị ngoài nhánh đang chọn (kiểm tra X-Target-Unit-Id).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}

function assertJobTitleRowStorage(rowUnitId, dataScope) {
  if (rowUnitId !== dataScope.storageUnitId) {
    throw new AppError({
      message: "Job title was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
}

function assertLogicalMatchesDataScope(unitId, dataScope) {
  if (!dataScope || dataScope.storageUnitId == null) {
    throw new AppError({
      message: "Thiếu phạm vi dữ liệu chức danh",
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  if (unitId != null && Number(unitId) !== Number(dataScope.logicalUnitId)) {
    throw new AppError({
      message: "unitId không khớp ngữ cảnh đơn vị đang chọn",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function listJobTitles(scope, effectiveUnitIds, dataScope) {
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  return prisma.jobTitle.findMany({
    where: { unitId: dataScope.storageUnitId },
    include: JOB_TITLE_INCLUDE,
    orderBy: [{ name: "asc" }],
  });
}

async function getJobTitleById(jobTitleId, scope, effectiveUnitIds, dataScope) {
  const row = await prisma.jobTitle.findFirst({
    where: { id: jobTitleId },
    include: JOB_TITLE_INCLUDE,
  });

  if (!row) {
    throw new AppError({
      message: "Job title was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  assertJobTitleRowStorage(row.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  return row;
}

async function createJobTitle(payload, scope, effectiveUnitIds, dataScope) {
  assertLogicalMatchesDataScope(payload.unitId, dataScope);
  assertUnitIdInScope(payload.unitId, scope);
  assertUnitInEffectiveBranch(payload.unitId, effectiveUnitIds);
  await assertLogicalUnitIsLevel1ForWrite(dataScope.logicalUnitId);

  try {
    return await prisma.jobTitle.create({
      data: {
        unitId: dataScope.storageUnitId,
        name: payload.name,
        description: payload.description ?? null,
        isActive: payload.isActive ?? true,
      },
      include: JOB_TITLE_INCLUDE,
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
}

async function patchJobTitle(jobTitleId, payload, scope, effectiveUnitIds, dataScope) {
  await assertLogicalUnitIsLevel1ForWrite(dataScope.logicalUnitId);
  await getJobTitleById(jobTitleId, scope, effectiveUnitIds, dataScope);

  const data = {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
  };

  if (!Object.keys(data).length) {
    return getJobTitleById(jobTitleId, scope, effectiveUnitIds, dataScope);
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

  return getJobTitleById(jobTitleId, scope, effectiveUnitIds, dataScope);
}

async function deactivateJobTitle(jobTitleId, scope, effectiveUnitIds, dataScope) {
  await assertLogicalUnitIsLevel1ForWrite(dataScope.logicalUnitId);
  await getJobTitleById(jobTitleId, scope, effectiveUnitIds, dataScope);
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

  return getJobTitleById(jobTitleId, scope, effectiveUnitIds, dataScope);
}

async function setJobTitlePermissions(jobTitleId, permissionIds, actor, scope, effectiveUnitIds, dataScope) {
  await assertLogicalUnitIsLevel1ForWrite(dataScope.logicalUnitId);
  await getJobTitleById(jobTitleId, scope, effectiveUnitIds, dataScope);

  if (!permissionIds.length) {
    await prisma.jobTitlePermission.deleteMany({ where: { jobTitleId } });
    return getJobTitleById(jobTitleId, scope, effectiveUnitIds, dataScope);
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

  await prisma.$transaction(async (tx) => {
    await tx.jobTitlePermission.deleteMany({ where: { jobTitleId } });
    await tx.jobTitlePermission.createMany({
      data: permissionIds.map((permissionId) => ({ jobTitleId, permissionId })),
    });
  });

  return getJobTitleById(jobTitleId, scope, effectiveUnitIds, dataScope);
}

export {
  createJobTitle,
  deactivateJobTitle,
  getJobTitleById,
  listJobTitles,
  patchJobTitle,
  setJobTitlePermissions,
};
