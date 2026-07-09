import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { mapAuthPayload } from "./auth.mapper.js";
import { DEFAULT_ADMIN_PERMISSION_CODES } from "../../shared/constants/default-admin-permissions.js";
import {
  ensureSampleUnitHierarchy,
  rebuildAllUnitPaths,
} from "../../shared/units/unit-scope.service.js";
import {
  ensureUnitLevelPermissionCapsSeed,
  getCapPermissionIdsForDepth,
} from "../../shared/permissions/unit-level-cap.service.js";
import { LTTP_MODULE_NAME } from "../lttp/lttp.constants.js";
import { isTransactionalMailConfigured } from "../../infra/mail/mail-capabilities.js";
import { dispatchVerificationEmail } from "../../infra/mail/verification-email.dispatcher.js";
import { logger } from "../../shared/utils/logger.js";

/** Đổi mã quyền cũ `lrtp.*` thành `lttp.*` tại chỗ để giữ `permissionId` và TypePermission. */
const LEGACY_LRTP_TO_LTTP_PERMISSION_CODE = {
  "lrtp.commodities.read": "lttp.commodities.read",
  "lrtp.commodities.write": "lttp.commodities.write",
  "lrtp.prices.read": "lttp.prices.read",
  "lrtp.prices.write": "lttp.prices.write",
};

async function migrateLegacyLrtpPermissionCodes() {
  for (const [oldCode, newCode] of Object.entries(LEGACY_LRTP_TO_LTTP_PERMISSION_CODE)) {
    const [existingOld, existingNew] = await Promise.all([
      prisma.permission.findUnique({ where: { code: oldCode } }),
      prisma.permission.findUnique({ where: { code: newCode } }),
    ]);
    if (!existingOld || existingNew) {
      continue;
    }
    await prisma.permission.update({
      where: { id: existingOld.id },
      data: {
        code: newCode,
        module: LTTP_MODULE_NAME,
      },
    });
  }
}

const AUTH_USER_INCLUDE = {
  type: {
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  },
  unit: true,
  assignedUnit: true,
  profile: true,
  jobTitle: {
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  },
};

const SYSTEM_TYPE_NAMES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  USER: "user",
};

const DEFAULT_REGISTRATION_UNIT_NAME = "Đơn vị mặc định";

function mergePermissionRecords(typePermissions, jobTitlePermissions) {
  const byCode = new Map();
  for (const p of typePermissions || []) {
    if (p?.code) {
      byCode.set(p.code, p);
    }
  }
  for (const p of jobTitlePermissions || []) {
    if (p?.code) {
      byCode.set(p.code, p);
    }
  }
  return [...byCode.values()];
}

async function normalizeUser(user) {
  if (!user) {
    return null;
  }

  const typePerms = user.type?.permissions?.map(({ permission }) => permission) || [];
  const jobPerms = user.jobTitle?.permissions?.map(({ permission }) => permission) || [];
  let permissions = mergePermissionRecords(typePerms, jobPerms);

  if (user.type?.name === SYSTEM_TYPE_NAMES.SUPERADMIN) {
    return {
      ...user,
      permissions,
    };
  }

  const depth = user.unit?.depth;
  if (user.unitId == null || depth === undefined || depth === null) {
    return {
      ...user,
      permissions,
    };
  }

  const allowedIds = await getCapPermissionIdsForDepth(depth);
  if (allowedIds.size === 0) {
    permissions = [];
  } else {
    permissions = permissions.filter((p) => allowedIds.has(p.id));
  }

  return {
    ...user,
    permissions,
  };
}

async function findAuthUserByEmailNormalized(email) {
  const trimmed = typeof email === "string" ? email.trim() : "";
  if (!trimmed) {
    return null;
  }
  const tryEmails = [...new Set([trimmed, trimmed.toLowerCase()])];
  for (const e of tryEmails) {
    const raw = await prisma.user.findFirst({
      where: { email: e, deletedAt: null },
      include: AUTH_USER_INCLUDE,
    });
    if (raw) {
      return normalizeUser(raw);
    }
  }
  return null;
}

function createAuthError() {
  return new AppError({
    message: "Tên đăng nhập hoặc mật khẩu không đúng",
    statusCode: 401,
    code: ERROR_CODES.UNAUTHORIZED,
  });
}

function assertActiveUser(user) {
  if (!user || user.deletedAt || !user.isActive) {
    throw createAuthError();
  }
  if (user.type?.name !== SYSTEM_TYPE_NAMES.SUPERADMIN) {
    if (user.registrationStatus === "PENDING_APPROVAL" || user.registrationStatus === "REJECTED") {
      throw createAuthError();
    }
  }
}

function createAccessToken(user) {
  return jwt.sign(mapAuthPayload(user), config.auth.jwtAccessSecret, {
    expiresIn: config.auth.accessTokenExpiresIn,
  });
}

function createRefreshTokenValue() {
  return crypto.randomBytes(48).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getRefreshTokenExpiryDate() {
  const days =
    Number.isFinite(config.auth.refreshTokenExpiresDays) && config.auth.refreshTokenExpiresDays > 0
      ? config.auth.refreshTokenExpiresDays
      : 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

function saveSession(req, sessionData) {
  return new Promise((resolve, reject) => {
    req.session.auth = sessionData;
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function getUserById(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: AUTH_USER_INCLUDE,
  });

  return await normalizeUser(user);
}

async function getCurrentUser(authUser) {
  if (!authUser?.id) {
    throw createAuthError();
  }

  const user = await getUserById(authUser.id);
  assertActiveUser(user);
  return user;
}

async function issueSessionForUser({ req, user, ipAddress, userAgent }) {
  const sessionId = crypto.randomUUID();
  const refreshTokenValue = createRefreshTokenValue();
  const refreshToken = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      sessionId,
      tokenHash: hashToken(refreshTokenValue),
      userAgent,
      ipAddress,
      expiresAt: getRefreshTokenExpiryDate(),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
    },
  });

  await saveSession(req, {
    userId: user.id,
    sessionId,
    refreshTokenId: refreshToken.id,
  });

  return {
    accessToken: createAccessToken(user),
    refreshToken: refreshTokenValue,
    user,
  };
}

async function login({ req, identifier, password, ipAddress, userAgent }) {
  const raw = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ email: identifier }, { username: identifier }],
    },
    include: AUTH_USER_INCLUDE,
  });

  if (!raw) {
    throw createAuthError();
  }

  const isPasswordValid = await bcrypt.compare(password, raw.password);

  if (!isPasswordValid) {
    throw createAuthError();
  }

  const user = await normalizeUser(raw);

  if (user.registrationStatus === "PENDING_APPROVAL") {
    throw new AppError({
      message:
        "Tài khoản đang chờ quản trị đơn vị duyệt (chỉ quản trị từ cấp chỉ định trở lên trong cùng nhánh đơn vị).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  if (user.registrationStatus === "REJECTED") {
    throw new AppError({
      message: "Đăng ký của bạn đã bị từ chối. Liên hệ quản trị đơn vị.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  assertActiveUser(user);
  assertEmailVerifiedForLogin(user);

  return issueSessionForUser({
    req,
    user,
    ipAddress,
    userAgent,
  });
}

async function loginWithGoogleAccount({ req, email, ipAddress, userAgent }) {
  const user = await findAuthUserByEmailNormalized(email);

  if (!user) {
    throw new AppError({
      message: "Không tìm thấy tài khoản với email Google này. Vui lòng đăng ký trước.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  if (user.registrationStatus === "PENDING_APPROVAL") {
    throw new AppError({
      message:
        "Tài khoản đang chờ quản trị đơn vị duyệt (chỉ quản trị từ cấp chỉ định trở lên trong cùng nhánh đơn vị).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  if (user.registrationStatus === "REJECTED") {
    throw new AppError({
      message: "Đăng ký của bạn đã bị từ chối. Liên hệ quản trị đơn vị.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  assertActiveUser(user);

  let activeUser = user;
  if (!user.emailVerifiedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    activeUser = await getUserById(user.id);
  }

  assertEmailVerifiedForLogin(activeUser);

  return issueSessionForUser({
    req,
    user: activeUser,
    ipAddress,
    userAgent,
  });
}

function assertEmailVerifiedForLogin(user) {
  if (!config.auth.requireEmailVerification) {
    return;
  }
  if (user.type?.name === SYSTEM_TYPE_NAMES.SUPERADMIN) {
    return;
  }
  if (user.emailVerifiedAt) {
    return;
  }
  throw new AppError({
    message:
      "Vui lòng xác minh email trước khi đăng nhập. Kiểm tra hộp thư (kể cả mục spam) để nhận liên kết xác minh.",
    statusCode: 403,
    code: ERROR_CODES.FORBIDDEN,
  });
}

async function getRegisterUnits() {
  return prisma.unit.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

async function register({ req, username, email, password, unitId, ipAddress, userAgent }) {
  const existingUser = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ username }, { email }],
    },
  });

  if (existingUser) {
    throw new AppError({
      message: "Username or email already exists",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }

  const [userType, unit] = await Promise.all([
    prisma.type.findUnique({
      where: {
        name: SYSTEM_TYPE_NAMES.USER,
      },
    }),
    prisma.unit.findFirst({
      where: {
        id: unitId,
        isActive: true,
      },
    }),
  ]);

  if (!userType) {
    throw new AppError({
      message: "Registration is temporarily unavailable",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  if (!unit) {
    throw new AppError({
      message: "Selected unit is not available",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const requiresApproval = config.auth.registrationRequiresApproval;
  const requireVerification = config.auth.requireEmailVerification;

  let rawVerificationToken = null;
  let emailVerificationTokenHash = null;
  let emailVerificationExpiresAt = null;
  const emailVerifiedAt = null;

  if (requireVerification) {
    rawVerificationToken = crypto.randomBytes(32).toString("hex");
    emailVerificationTokenHash = hashToken(rawVerificationToken);
    emailVerificationExpiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  }

  const user = await normalizeUser(
    await prisma.user.create({
      data: {
        username,
        email,
        password: await bcrypt.hash(password, 10),
        typeId: userType.id,
        unitId: unit.id,
        isActive: !requiresApproval,
        registrationStatus: requiresApproval ? "PENDING_APPROVAL" : "APPROVED",
        emailVerifiedAt,
        emailVerificationTokenHash,
        emailVerificationExpiresAt,
        profile: {
          create: {
            fullName: username,
          },
        },
      },
      include: AUTH_USER_INCLUDE,
    }),
  );

  if (requireVerification && rawVerificationToken) {
    if (isTransactionalMailConfigured()) {
      try {
        await dispatchVerificationEmail({
          to: email,
          token: rawVerificationToken,
          username,
        });
      } catch (err) {
        logger.warn({ err, email }, "Gửi / xếp hàng email xác minh thất bại");
      }
    } else {
      logger.warn(
        { email },
        "REQUIRE_EMAIL_VERIFICATION bật nhưng chưa cấu hình gửi mail (SMTP hoặc Gmail API) — không gửi được mail xác minh",
      );
    }
  }

  if (requiresApproval) {
    return { pending: true, user };
  }

  if (requireVerification) {
    return { needsVerification: true, user };
  }

  return issueSessionForUser({
    req,
    user,
    ipAddress,
    userAgent,
  });
}

async function verifyEmailWithToken(rawToken) {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 16) {
    throw new AppError({
      message: "Token xác minh không hợp lệ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const tokenHash = hashToken(rawToken);
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw new AppError({
      message: "Liên kết xác minh không hợp lệ hoặc đã hết hạn.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    },
  });

  return { ok: true };
}

async function refreshSession({ req, refreshToken, ipAddress, userAgent }) {
  if (!refreshToken) {
    throw createAuthError();
  }

  const hashedToken = hashToken(refreshToken);
  const storedToken = await prisma.refreshToken.findUnique({
    where: {
      tokenHash: hashedToken,
    },
    include: {
      user: {
        include: AUTH_USER_INCLUDE,
      },
    },
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
    throw createAuthError();
  }

  if (req.session?.auth?.sessionId && req.session.auth.sessionId !== storedToken.sessionId) {
    throw createAuthError();
  }

  const user = await normalizeUser(storedToken.user);
  assertActiveUser(user);

  const nextRefreshTokenValue = createRefreshTokenValue();
  const expiresAt = getRefreshTokenExpiryDate();

  const [, nextRefreshToken] = await prisma.$transaction([
    prisma.refreshToken.update({
      where: {
        id: storedToken.id,
      },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
      },
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: storedToken.sessionId,
        tokenHash: hashToken(nextRefreshTokenValue),
        userAgent,
        ipAddress,
        expiresAt,
      },
    }),
  ]);

  await saveSession(req, {
    userId: user.id,
    sessionId: storedToken.sessionId,
    refreshTokenId: nextRefreshToken.id,
  });

  return {
    accessToken: createAccessToken(user),
    refreshToken: nextRefreshTokenValue,
    user,
  };
}

async function logout({ req, refreshToken }) {
  const sessionRefreshTokenId = req.session?.auth?.refreshTokenId;
  const tokenHash = refreshToken ? hashToken(refreshToken) : null;
  const revokeTargets = [
    ...(sessionRefreshTokenId ? [{ id: sessionRefreshTokenId }] : []),
    ...(tokenHash ? [{ tokenHash }] : []),
  ];

  if (revokeTargets.length) {
    await prisma.refreshToken.updateMany({
      where: {
        OR: revokeTargets,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  await destroySession(req);
}

async function authenticateAccessToken({ accessToken, sessionAuth }) {
  if (!accessToken || !sessionAuth?.userId) {
    throw createAuthError();
  }

  let payload;

  try {
    payload = jwt.verify(accessToken, config.auth.jwtAccessSecret);
  } catch (_error) {
    throw createAuthError();
  }

  if (Number(payload.sub) !== sessionAuth.userId) {
    throw createAuthError();
  }

  const user = await getUserById(sessionAuth.userId);
  assertActiveUser(user);
  return user;
}

async function syncPermissionsFromRoutes(routeDefinitions = []) {
  if (!routeDefinitions.length) {
    return;
  }

  await migrateLegacyLrtpPermissionCodes();

  const byCode = new Map();
  for (const rp of routeDefinitions) {
    byCode.set(rp.code, rp);
  }
  const unique = [...byCode.values()];

  await prisma.$transaction(
    unique.map((routePermission) =>
      prisma.permission.upsert({
        where: {
          code: routePermission.code,
        },
        update: {
          name: routePermission.name,
          method: routePermission.method,
          module: routePermission.module,
          pathRoute: routePermission.pathRoute,
          isSystem: true,
        },
        create: {
          code: routePermission.code,
          name: routePermission.name,
          description: routePermission.description ?? null,
          method: routePermission.method,
          module: routePermission.module,
          pathRoute: routePermission.pathRoute,
          isSystem: true,
        },
      }),
    ),
  );

  await Promise.all(
    unique.map((rp) =>
      prisma.permission.updateMany({
        where: {
          code: rp.code,
          OR: [{ description: null }, { description: "" }],
        },
        data: { description: rp.description ?? null },
      }),
    ),
  );
}

async function ensureSystemTypes() {
  const [superadminType, adminType, userType] = await Promise.all([
    prisma.type.upsert({
      where: {
        name: SYSTEM_TYPE_NAMES.SUPERADMIN,
      },
      update: {
        isSystem: true,
        description: "System superadmin with full access.",
      },
      create: {
        name: SYSTEM_TYPE_NAMES.SUPERADMIN,
        isSystem: true,
        description: "System superadmin with full access.",
      },
    }),
    prisma.type.upsert({
      where: {
        name: SYSTEM_TYPE_NAMES.ADMIN,
      },
      update: {
        isSystem: true,
        description: "Default admin role for self-registered users.",
      },
      create: {
        name: SYSTEM_TYPE_NAMES.ADMIN,
        isSystem: true,
        description: "Default admin role for self-registered users.",
      },
    }),
    prisma.type.upsert({
      where: {
        name: SYSTEM_TYPE_NAMES.USER,
      },
      update: {
        isSystem: true,
        description: "Default user role waiting for permission assignment.",
      },
      create: {
        name: SYSTEM_TYPE_NAMES.USER,
        isSystem: true,
        description: "Default user role waiting for permission assignment.",
      },
    }),
  ]);

  return { superadminType, adminType, userType };
}

async function ensureDefaultRegistrationUnit() {
  const activeUnitCount = await prisma.unit.count({
    where: {
      isActive: true,
    },
  });

  if (activeUnitCount > 0) {
    return;
  }

  await prisma.unit.create({
    data: {
      name: DEFAULT_REGISTRATION_UNIT_NAME,
      description: "Đơn vị khởi tạo mặc định để tiếp nhận tài khoản mới đăng ký.",
      isActive: true,
    },
  });
}

async function assignPermissionsToType({ typeId, permissionCodes }) {
  if (!permissionCodes.length) {
    return;
  }

  const permissions = await prisma.permission.findMany({
    where: {
      code: {
        in: permissionCodes,
      },
    },
    select: {
      id: true,
    },
  });

  await prisma.$transaction(
    permissions.map((permission) =>
      prisma.typePermission.upsert({
        where: {
          typeId_permissionId: {
            typeId,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          typeId,
          permissionId: permission.id,
        },
      }),
    ),
  );
}

async function bootstrapSuperadmin(superadminTypeId) {
  if (!config.auth.runSuperadminBootstrap) {
    return;
  }

  const existingSuperadmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: config.auth.superadminEmail },
        { username: config.auth.superadminUsername },
      ],
    },
  });

  if (existingSuperadmin) {
    return;
  }

  await prisma.user.create({
    data: {
      username: config.auth.superadminUsername,
      email: config.auth.superadminEmail,
      password: await bcrypt.hash(config.auth.superadminPassword, 10),
      typeId: superadminTypeId,
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          fullName: config.auth.superadminFullName,
        },
      },
    },
  });
}

async function ensureUnitLevelMetadata() {
  for (let depth = 0; depth <= 5; depth += 1) {
    await prisma.unitLevelMetadata.upsert({
      where: { depth },
      update: {},
      create: {
        depth,
        label: `Cấp ${depth + 1}`,
      },
    });
  }
}

async function bootstrapAuthSystem(routeDefinitions = []) {
  const { superadminType, adminType } = await ensureSystemTypes();
  await ensureDefaultRegistrationUnit();
  await ensureSampleUnitHierarchy();
  await rebuildAllUnitPaths();
  await ensureUnitLevelMetadata();

  // Luôn đồng bộ catalog quyền từ route (upsert an toàn) — kể cả khi PERMISSION_SYNC_ON_BOOT=false.
  await syncPermissionsFromRoutes(routeDefinitions);

  const allPermissions = await prisma.permission.findMany({
    select: {
      code: true,
    },
  });

  // Superadmin luôn nhận mọi quyền mới (upsert, không xóa quyền tùy chỉnh).
  await assignPermissionsToType({
    typeId: superadminType.id,
    permissionCodes: allPermissions.map((permission) => permission.code),
  });

  // Bổ sung quyền mặc định cho type admin (upsert — không gỡ quyền đã cấp thêm).
  await assignPermissionsToType({
    typeId: adminType.id,
    permissionCodes: DEFAULT_ADMIN_PERMISSION_CODES,
  });

  await ensureUnitLevelPermissionCapsSeed();

  await bootstrapSuperadmin(superadminType.id);
}

async function cleanupExpiredRefreshTokens() {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lt: new Date(),
          },
        },
        {
          revokedAt: {
            not: null,
          },
        },
      ],
    },
  });

  return result.count;
}

export {
  authenticateAccessToken,
  bootstrapAuthSystem,
  cleanupExpiredRefreshTokens,
  findAuthUserByEmailNormalized,
  getCurrentUser,
  getRegisterUnits,
  getUserById,
  login,
  loginWithGoogleAccount,
  logout,
  register,
  refreshSession,
  syncPermissionsFromRoutes,
  verifyEmailWithToken,
};
