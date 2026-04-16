import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { redis } from "../../infra/cache/redis.client.js";
import { logger } from "../../shared/utils/logger.js";
import { isTransactionalMailConfigured } from "../../infra/mail/mail-capabilities.js";
import {
  tryDispatchPasswordChangedEmail,
  tryDispatchPasswordResetEmail,
} from "../../infra/mail/password-emails.dispatcher.js";
import { findAuthUserByEmailNormalized } from "./auth.service.js";
import {
  assertPasswordChangeAllowed,
  clearPasswordChangeThrottle,
  registerWrongCurrentPassword,
} from "./password-change-throttle.service.js";

const RESET_COOLDOWN_SEC = 90;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function assertUserMayUsePasswordReset(user) {
  if (!user?.isActive || user.deletedAt) {
    return false;
  }
  if (user.registrationStatus === "PENDING_APPROVAL" || user.registrationStatus === "REJECTED") {
    return false;
  }
  return true;
}

async function changePasswordForUser({ userId, currentPassword, newPassword }) {
  if (currentPassword === newPassword) {
    throw new AppError({
      message: "Mật khẩu mới phải khác mật khẩu hiện tại.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  await assertPasswordChangeAllowed(userId);

  const raw = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      password: true,
      email: true,
      username: true,
    },
  });

  if (!raw) {
    throw new AppError({
      message: "Không tìm thấy tài khoản.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  const match = await bcrypt.compare(currentPassword, raw.password);
  if (!match) {
    await registerWrongCurrentPassword(userId);
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await clearPasswordChangeThrottle(userId);

  if (isTransactionalMailConfigured()) {
    tryDispatchPasswordChangedEmail({
      to: raw.email,
      username: raw.username,
    }).catch((err) => {
      logger.error({ err, userId }, "Không gửi được email thông báo đổi mật khẩu");
    });
  } else {
    logger.warn({ userId }, "Chưa cấu hình mail — bỏ qua email thông báo đổi mật khẩu");
  }

  return { ok: true };
}

/**
 * Luôn trả outcome an toàn cho client (không lộ email có tồn tại hay không).
 */
async function requestPasswordResetByEmail(email) {
  const trimmed = typeof email === "string" ? email.trim() : "";
  if (!trimmed) {
    return { outcome: "silent" };
  }

  const user = await findAuthUserByEmailNormalized(trimmed);
  if (!user || !assertUserMayUsePasswordReset(user)) {
    return { outcome: "silent" };
  }

  if (!isTransactionalMailConfigured()) {
    logger.warn("Quên mật khẩu: chưa cấu hình SMTP/Gmail API — không gửi email");
    return { outcome: "silent" };
  }

  if (redis) {
    const rk = `pwd-reset:rl:${user.id}`;
    const set = await redis.set(rk, "1", "EX", RESET_COOLDOWN_SEC, "NX");
    if (set !== "OK") {
      return { outcome: "silent" };
    }
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  try {
    await tryDispatchPasswordResetEmail({
      to: user.email,
      token: rawToken,
      username: user.username,
    });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Không gửi được email đặt lại mật khẩu");
  }

  return { outcome: "processed" };
}

async function resetPasswordWithToken(rawToken, newPassword) {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 16) {
    throw new AppError({
      message: "Liên kết đặt lại mật khẩu không hợp lệ.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const tokenHash = hashToken(rawToken);
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      isActive: true,
      registrationStatus: true,
    },
  });

  if (!user || !assertUserMayUsePasswordReset(user)) {
    throw new AppError({
      message: "Liên kết không hợp lệ hoặc đã hết hạn. Yêu cầu gửi lại email quên mật khẩu.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

export { changePasswordForUser, requestPasswordResetByEmail, resetPasswordWithToken };
