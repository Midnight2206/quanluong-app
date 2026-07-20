import bcrypt from "bcryptjs";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  assertUnitIdInScope,
  entityUnitIdWhere,
  UNIT_SCOPE_MODES,
} from "../../shared/units/unit-scope.service.js";

const USER_INCLUDE = {
  type: true,
  unit: true,
  assignedUnit: true,
  profile: true,
  jobTitle: true,
};

const ADMIN_TYPE_NAME = "admin";
const SUPERADMIN_TYPE_NAME = "superadmin";

async function assertAdminOnlyOnLevel1(typeId, unitId) {
  if (unitId == null || typeId == null) {
    return;
  }
  const type = await prisma.type.findUnique({ where: { id: typeId } });
  if (!type || type.name !== ADMIN_TYPE_NAME) {
    return;
  }
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { depth: true },
  });
  if (!unit || unit.depth !== 0) {
    throw new AppError({
      message: "Chỉ đơn vị cấp 1 được gán tài khoản admin",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

/** Đơn vị có ít nhất một tài khoản admin đang hoạt động (nghiệp vụ địa phương). */
async function unitHasAdminUser(unitId) {
  if (unitId == null) {
    return false;
  }
  const adminType = await prisma.type.findFirst({
    where: { name: ADMIN_TYPE_NAME },
    select: { id: true },
  });
  if (!adminType) {
    return false;
  }
  const n = await prisma.user.count({
    where: {
      unitId,
      typeId: adminType.id,
      isActive: true,
      deletedAt: null,
    },
  });
  return n > 0;
}

/**
 * Chức danh gắn đơn vị `jobTitleUnitId` có áp dụng cho user ở `userUnitId` không
 * (cùng đơn vị hoặc chức danh thuộc đơn vị tổ tiên khi đi từ user lên gốc).
 */
async function isJobTitleUnitOnUserBranch(jobTitleUnitId, userUnitId) {
  if (jobTitleUnitId == null || userUnitId == null) {
    return false;
  }
  const seen = new Set();
  let cur = userUnitId;
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    if (cur === jobTitleUnitId) {
      return true;
    }
    const u = await prisma.unit.findUnique({
      where: { id: cur },
      select: { parentId: true },
    });
    cur = u?.parentId ?? null;
  }
  return false;
}

/**
 * - Cùng đơn vị: luôn được.
 * - Khác đơn vị: chỉ khi đơn vị user chưa có admin địa phương và chức danh thuộc đơn vị cấp trên trên nhánh.
 */
async function assertJobTitleAssignableToUser(jobTitleId, userUnitId) {
  if (!jobTitleId || !userUnitId) {
    return;
  }
  const jt = await prisma.jobTitle.findUnique({
    where: { id: jobTitleId },
    select: { unitId: true },
  });
  if (!jt) {
    return;
  }
  if (jt.unitId === userUnitId) {
    return;
  }
  const hasLocalAdmin = await unitHasAdminUser(userUnitId);
  if (hasLocalAdmin) {
    throw new AppError({
      message:
        "Chức danh phải thuộc đúng đơn vị của người dùng — đơn vị này đã có tài khoản admin.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const ok = await isJobTitleUnitOnUserBranch(jt.unitId, userUnitId);
  if (!ok) {
    throw new AppError({
      message:
        "Chức danh không thuộc đơn vị của người dùng hoặc đơn vị cấp trên trên cùng nhánh — khi đơn vị chưa có admin, chỉ dùng chức danh do cấp trên khai báo.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function ensureRelationsExist({ typeId, unitId, assignedUnitId, jobTitleId }, scope) {
  const [type, unit, assignedUnit, jobTitle] = await Promise.all([
    typeId ? prisma.type.findUnique({ where: { id: typeId } }) : null,
    unitId ? prisma.unit.findUnique({ where: { id: unitId } }) : null,
    assignedUnitId ? prisma.assignedUnit.findUnique({ where: { id: assignedUnitId } }) : null,
    jobTitleId ? prisma.jobTitle.findUnique({ where: { id: jobTitleId } }) : null,
  ]);

  if (typeId && !type) {
    throw new AppError({
      message: "Referenced type was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  if (unitId && !unit) {
    throw new AppError({
      message: "Referenced unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  if (assignedUnitId && !assignedUnit) {
    throw new AppError({
      message: "Referenced assigned unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  if (jobTitleId && !jobTitle) {
    throw new AppError({
      message: "Referenced job title was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  if (assignedUnit && unitId && assignedUnit.unitId !== unitId) {
    throw new AppError({
      message: "Assigned unit does not belong to the selected unit",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (scope?.mode && scope.mode !== UNIT_SCOPE_MODES.ALL) {
    if (unitId && unit) {
      assertUnitIdInScope(unit.id, scope);
    }
    if (assignedUnitId && assignedUnit) {
      assertUnitIdInScope(assignedUnit.unitId, scope);
    }
    if (jobTitleId && jobTitle) {
      assertUnitIdInScope(jobTitle.unitId, scope);
    }
  }

  if (jobTitleId && jobTitle && unitId && unit) {
    await assertJobTitleAssignableToUser(jobTitleId, unit.id);
  }

  return {
    type,
    unit,
    assignedUnit,
    jobTitle,
  };
}

async function ensureUniqueUserFields({ username, email, excludeUserId }) {
  const orConditions = [
    ...(username ? [{ username }] : []),
    ...(email ? [{ email }] : []),
  ];

  if (!orConditions.length) {
    return;
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: orConditions,
      ...(excludeUserId
        ? {
            NOT: {
              id: excludeUserId,
            },
          }
        : {}),
    },
  });

  if (existingUser) {
    throw new AppError({
      message: "Username or email already exists",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
}

async function listUsers(scope, effectiveUnitIds) {
  return prisma.user.findMany({
    where: {
      deletedAt: null,
      ...entityUnitIdWhere(scope, effectiveUnitIds),
    },
    include: USER_INCLUDE,
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function getUserById(userId, scope, effectiveUnitIds) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
      ...entityUnitIdWhere(scope, effectiveUnitIds),
    },
    include: USER_INCLUDE,
  });

  if (!user) {
    throw new AppError({
      message: "User was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  return user;
}

async function createUser(payload, scope, effectiveUnitIds) {
  const relations = await ensureRelationsExist(
    {
      typeId: payload.typeId,
      unitId: payload.unitId,
      assignedUnitId: payload.assignedUnitId,
      jobTitleId: payload.jobTitleId,
    },
    scope,
  );
  await ensureUniqueUserFields({
    username: payload.username,
    email: payload.email,
  });

  const effectiveUnitId = payload.unitId || relations.assignedUnit?.unitId || null;
  if (scope?.mode !== UNIT_SCOPE_MODES.ALL) {
    if (effectiveUnitId == null) {
      throw new AppError({
        message: "unitId or assignedUnitId is required",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    assertUnitIdInScope(effectiveUnitId, scope);
  }

  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    effectiveUnitId != null &&
    !effectiveUnitIds.includes(effectiveUnitId)
  ) {
    throw new AppError({
      message: "Đơn vị gán user ngoài nhánh đang chọn (kiểm tra X-Target-Unit-Id).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  const resolvedUnitId = payload.unitId || relations.assignedUnit?.unitId || null;
  await assertAdminOnlyOnLevel1(payload.typeId, resolvedUnitId);
  if (payload.jobTitleId && resolvedUnitId) {
    await assertJobTitleAssignableToUser(payload.jobTitleId, resolvedUnitId);
  }

  return prisma.user.create({
    data: {
      username: payload.username,
      email: payload.email,
      password: hashedPassword,
      typeId: payload.typeId,
      unitId: resolvedUnitId,
      assignedUnitId: payload.assignedUnitId || null,
      jobTitleId: payload.jobTitleId || null,
      registrationStatus: "APPROVED",
      emailVerifiedAt: relations.type?.name === SUPERADMIN_TYPE_NAME ? new Date() : null,
      profile: {
        create: payload.profile,
      },
    },
    include: USER_INCLUDE,
  });
}

async function patchUser(userId, payload, scope, options = {}) {
  const { actorId = null, effectiveUnitIds } = options;
  await getUserById(userId, scope, effectiveUnitIds);

  if (
    actorId != null &&
    userId === actorId &&
    Object.hasOwn(payload, "jobTitleId")
  ) {
    throw new AppError({
      message: "Không thể tự gán hoặc tự đổi chức danh cho chính mình.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  if (payload.username || payload.email) {
    await ensureUniqueUserFields({
      username: payload.username,
      email: payload.email,
      excludeUserId: userId,
    });
  }

  if (payload.typeId || payload.unitId || payload.assignedUnitId || payload.jobTitleId) {
    await ensureRelationsExist(
      {
        typeId: payload.typeId,
        unitId: payload.unitId,
        assignedUnitId: payload.assignedUnitId,
        jobTitleId: payload.jobTitleId,
      },
      scope,
    );
    if (!payload.unitId && payload.assignedUnitId) {
      const au = await prisma.assignedUnit.findUnique({
        where: { id: payload.assignedUnitId },
      });
      if (au?.unitId) {
        payload.unitId = au.unitId;
      }
    }
  }

  if (Object.hasOwn(payload, "unitId")) {
    assertUnitIdInScope(payload.unitId ?? null, scope, {
      allowNull: scope?.mode === UNIT_SCOPE_MODES.ALL,
    });
  }

  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    Object.hasOwn(payload, "unitId") &&
    payload.unitId != null &&
    !effectiveUnitIds.includes(payload.unitId)
  ) {
    throw new AppError({
      message: "Đơn vị đích ngoài nhánh đang chọn.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  if (Object.hasOwn(payload, "jobTitleId") && payload.jobTitleId) {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { unitId: true },
    });
    if (row?.unitId) {
      await assertJobTitleAssignableToUser(payload.jobTitleId, row.unitId);
    }
  }

  const existingForAdmin = await prisma.user.findUnique({
    where: { id: userId },
    select: { typeId: true, unitId: true },
  });
  const nextTypeId = payload.typeId ?? existingForAdmin?.typeId;
  const nextUnitId = Object.hasOwn(payload, "unitId")
    ? payload.unitId
    : existingForAdmin?.unitId;
  await assertAdminOnlyOnLevel1(nextTypeId, nextUnitId);

  const data = {
    ...(payload.username ? { username: payload.username } : {}),
    ...(payload.email ? { email: payload.email } : {}),
    ...(payload.typeId ? { typeId: payload.typeId } : {}),
    ...(Object.hasOwn(payload, "unitId") ? { unitId: payload.unitId || null } : {}),
    ...(Object.hasOwn(payload, "assignedUnitId")
      ? { assignedUnitId: payload.assignedUnitId || null }
      : {}),
    ...(Object.hasOwn(payload, "jobTitleId") ? { jobTitleId: payload.jobTitleId || null } : {}),
    ...(Object.hasOwn(payload, "isActive") ? { isActive: payload.isActive } : {}),
    ...(payload.password ? { password: await bcrypt.hash(payload.password, 10) } : {}),
    ...(payload.profile
      ? {
          profile: {
            upsert: {
              update: payload.profile,
              create: {
                fullName: payload.profile.fullName || payload.username || "New user",
                ...payload.profile,
              },
            },
          },
        }
      : {}),
  };

  return prisma.user.update({
    where: {
      id: userId,
    },
    data,
    include: USER_INCLUDE,
  });
}

async function replaceUser(userId, payload, scope, effectiveUnitIds) {
  await getUserById(userId, scope, effectiveUnitIds);
  const relations = await ensureRelationsExist(
    {
      typeId: payload.typeId,
      unitId: payload.unitId,
      assignedUnitId: payload.assignedUnitId,
      jobTitleId: payload.jobTitleId,
    },
    scope,
  );
  await ensureUniqueUserFields({
    username: payload.username,
    email: payload.email,
    excludeUserId: userId,
  });

  const effectiveUnitId = payload.unitId || relations.assignedUnit?.unitId || null;
  if (scope?.mode !== UNIT_SCOPE_MODES.ALL) {
    if (effectiveUnitId == null) {
      throw new AppError({
        message: "unitId or assignedUnitId is required",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    assertUnitIdInScope(effectiveUnitId, scope);
  }

  if (payload.jobTitleId && effectiveUnitId) {
    await assertJobTitleAssignableToUser(payload.jobTitleId, effectiveUnitId);
  }

  await assertAdminOnlyOnLevel1(payload.typeId, effectiveUnitId);

  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      username: payload.username,
      email: payload.email,
      password: await bcrypt.hash(payload.password, 10),
      typeId: payload.typeId,
      unitId: effectiveUnitId,
      assignedUnitId: payload.assignedUnitId || null,
      jobTitleId: payload.jobTitleId || null,
      profile: {
        upsert: {
          update: payload.profile,
          create: payload.profile,
        },
      },
    },
    include: USER_INCLUDE,
  });
}

async function softDeleteUser(userId, scope, effectiveUnitIds) {
  await getUserById(userId, scope, effectiveUnitIds);

  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      deletedAt: new Date(),
      isActive: false,
      refreshTokens: {
        updateMany: {
          where: {
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        },
      },
    },
    include: USER_INCLUDE,
  });
}

export { createUser, getUserById, listUsers, patchUser, replaceUser, softDeleteUser };
