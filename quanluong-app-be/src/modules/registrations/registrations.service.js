import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  UNIT_SCOPE_MODES,
  unitIdsWhereClause,
} from "../../shared/units/unit-scope.service.js";

const REG_USER_INCLUDE = {
  type: true,
  unit: true,
  profile: true,
};

const SYSTEM_TYPE_NAMES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
};

function assertCanApproveRegistrations(actor) {
  if (actor?.type?.name === SYSTEM_TYPE_NAMES.SUPERADMIN) {
    return;
  }
  if (actor?.type?.name !== SYSTEM_TYPE_NAMES.ADMIN) {
    throw new AppError({
      message: "Only org admins can review registrations",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
  const depth = actor?.unit?.depth ?? -1;
  if (depth < config.auth.minUnitDepthToApproveRegistration) {
    const minLevel = config.auth.minUnitDepthToApproveRegistration + 1;
    throw new AppError({
      message: `Chỉ quản trị đơn vị từ cấp ${minLevel} trở lên (depth ≥ ${config.auth.minUnitDepthToApproveRegistration}) mới được duyệt đăng ký.`,
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}

async function listPendingRegistrations(scope) {
  return prisma.user.findMany({
    where: {
      deletedAt: null,
      registrationStatus: "PENDING_APPROVAL",
      ...unitIdsWhereClause(scope),
    },
    include: REG_USER_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
}

async function getPendingTargetOrThrow(userId, scope) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
      registrationStatus: "PENDING_APPROVAL",
      ...unitIdsWhereClause(scope),
    },
    include: { unit: true, type: true },
  });

  if (!user) {
    throw new AppError({
      message: "Pending registration was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  return user;
}

async function approveRegistration({ targetUserId, reviewer, scope }) {
  assertCanApproveRegistrations(reviewer);
  await getPendingTargetOrThrow(targetUserId, scope);

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      registrationStatus: "APPROVED",
      isActive: true,
      registrationReviewedAt: new Date(),
      registrationReviewedById: reviewer.id,
      registrationReviewNote: null,
    },
    include: REG_USER_INCLUDE,
  });

  return updated;
}

async function rejectRegistration({ targetUserId, reviewer, scope, note }) {
  assertCanApproveRegistrations(reviewer);
  await getPendingTargetOrThrow(targetUserId, scope);

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      registrationStatus: "REJECTED",
      isActive: false,
      registrationReviewedAt: new Date(),
      registrationReviewedById: reviewer.id,
      registrationReviewNote: note ?? null,
    },
    include: REG_USER_INCLUDE,
  });

  return updated;
}

export { approveRegistration, listPendingRegistrations, rejectRegistration };
