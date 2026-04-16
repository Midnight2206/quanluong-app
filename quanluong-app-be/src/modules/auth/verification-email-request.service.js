import crypto from "node:crypto";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { config } from "../../config/config.js";
import { isTransactionalMailConfigured } from "../../infra/mail/mail-capabilities.js";
import { redis } from "../../infra/cache/redis.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { dispatchVerificationEmail } from "../../infra/mail/verification-email.dispatcher.js";
import { findAuthUserByEmailNormalized } from "./auth.service.js";

const VERIFY_SEND_COOLDOWN_SEC = 90;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function requestVerificationEmailForUser(user) {
  if (user.emailVerifiedAt) {
    throw new AppError({
      message: "Email đã được xác minh.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (!isTransactionalMailConfigured()) {
    throw new AppError({
      message:
        config.mail.transport === "gmail_api"
          ? "Hệ thống chưa cấu hình Gmail API gửi thư (GCP + GMAIL_SENDER_* + OAuth) — không thể gửi email xác minh."
          : "Hệ thống chưa cấu hình SMTP — không thể gửi email xác minh.",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  if (redis) {
    const rk = `email-verify:rl:${user.id}`;
    const set = await redis.set(rk, "1", "EX", VERIFY_SEND_COOLDOWN_SEC, "NX");
    if (set !== "OK") {
      throw new AppError({
        message: `Vui lòng đợi khoảng ${VERIFY_SEND_COOLDOWN_SEC} giây trước khi gửi lại email.`,
        statusCode: 429,
        code: ERROR_CODES.RATE_LIMITED,
      });
    }
  }

  const raw = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationTokenHash: hashToken(raw),
      emailVerificationExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    },
  });

  const { viaQueue } = await dispatchVerificationEmail({
    to: user.email,
    token: raw,
    username: user.username,
  });

  return { viaQueue };
}

async function requestVerificationEmailByEmail(email) {
  const user = await findAuthUserByEmailNormalized(email);
  if (!user) {
    return { outcome: "silent" };
  }
  if (user.emailVerifiedAt) {
    return { outcome: "silent" };
  }
  if (user.registrationStatus === "PENDING_APPROVAL" || user.registrationStatus === "REJECTED") {
    return { outcome: "silent" };
  }
  if (!user.isActive) {
    return { outcome: "silent" };
  }
  const { viaQueue } = await requestVerificationEmailForUser(user);
  return { outcome: "sent", viaQueue };
}

export { requestVerificationEmailByEmail, requestVerificationEmailForUser };
