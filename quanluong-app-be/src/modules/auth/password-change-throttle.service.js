import { redis } from "../../infra/cache/redis.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

const failKey = (userId) => `pwd-change:fail:${userId}`;
const lockKey = (userId) => `pwd-change:lock:${userId}`;

/** Số lần nhập sai mật khẩu hiện tại trước khi khóa. */
const MAX_WRONG_ATTEMPTS = 5;
/** Đếm lần sai trong cửa sổ này (giây). */
const FAIL_WINDOW_SEC = 15 * 60;
/** Thời gian khóa đổi mật khẩu sau khi vượt ngưỡng (giây). */
const LOCKOUT_SEC = 15 * 60;

/**
 * Không có Redis → chỉ dựa vào rate limit POST /auth toàn cục; không đếm theo user.
 */
async function assertPasswordChangeAllowed(userId) {
  if (!redis) {
    return;
  }
  const lk = lockKey(userId);
  const ttl = await redis.ttl(lk);
  if (ttl > 0) {
    throw new AppError({
      message: `Đổi mật khẩu đang tạm khóa do nhập sai mật khẩu hiện tại quá nhiều lần. Thử lại sau khoảng ${Math.max(1, Math.ceil(ttl / 60))} phút.`,
      statusCode: 429,
      code: ERROR_CODES.RATE_LIMITED,
      details: { retryAfterSec: ttl },
    });
  }
}

/**
 * Ghi nhận mật khẩu hiện tại sai; ném 401 (còn lượt) hoặc 429 (vừa khóa).
 */
async function registerWrongCurrentPassword(userId) {
  if (!redis) {
    throw new AppError({
      message: "Mật khẩu hiện tại không đúng.",
      statusCode: 401,
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }

  const fk = failKey(userId);
  const fails = await redis.incr(fk);
  if (fails === 1) {
    await redis.expire(fk, FAIL_WINDOW_SEC);
  }

  if (fails >= MAX_WRONG_ATTEMPTS) {
    await redis.set(lockKey(userId), "1", "EX", LOCKOUT_SEC);
    await redis.del(fk);
    throw new AppError({
      message: `Đã khóa đổi mật khẩu trong ${Math.ceil(LOCKOUT_SEC / 60)} phút do nhập sai mật khẩu hiện tại quá nhiều lần.`,
      statusCode: 429,
      code: ERROR_CODES.RATE_LIMITED,
      details: { retryAfterSec: LOCKOUT_SEC },
    });
  }

  const remaining = MAX_WRONG_ATTEMPTS - fails;
  throw new AppError({
    message:
      remaining === 1
        ? "Mật khẩu hiện tại không đúng. Còn 1 lần thử trước khi tài khoản bị khóa đổi mật khẩu tạm thời."
        : `Mật khẩu hiện tại không đúng. Còn ${remaining} lần thử.`,
    statusCode: 401,
    code: ERROR_CODES.UNAUTHORIZED,
    details: { remainingAttempts: remaining },
  });
}

async function clearPasswordChangeThrottle(userId) {
  if (!redis) {
    return;
  }
  await redis.del(failKey(userId), lockKey(userId));
}

export {
  assertPasswordChangeAllowed,
  clearPasswordChangeThrottle,
  LOCKOUT_SEC,
  MAX_WRONG_ATTEMPTS,
  registerWrongCurrentPassword,
};
