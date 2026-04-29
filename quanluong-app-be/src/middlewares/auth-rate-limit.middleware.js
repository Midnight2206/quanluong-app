import crypto from "node:crypto";
import rateLimit from "express-rate-limit";

/**
 * Hạn ngạch theo **khóa ghép**: IP + bản định danh không trùng lặp (email / đăng nhập / đoạn token).
 * Cùng WiFi (NAT, chung IP) mà khác người dùng không còn chung một “ví” như chỉ throttle theo IP.
 */
function hashForRateKey(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 32);
}

function canonical(s) {
  if (!s || typeof s !== "string") return "";
  return s.normalize("NFKC").trim().toLowerCase().slice(0, 400);
}

/**
 * Khóa ổn định cho express-rate-limit; không chứa mật khẩu, chỉ hash/tồn dư vô hại để tách quota.
 *
 * @param {import('express').Request} req
 */
function rateLimitKey(req) {
  const ip = req.ip ?? /** @type {string} */ (req.socket?.remoteAddress ?? "unknown");
  const path = req.path ?? "";
  const body = req.body != null && typeof req.body === "object" ? req.body : {};

  let fp = "";

  switch (path) {
    case "/login": {
      const id = canonical(/** @type {{ identifier?: unknown }} */ (body).identifier);
      fp = id ? hashForRateKey(`login:${id}`) : "";
      break;
    }
    case "/register": {
      const em = canonical(/** @type {{ email?: unknown }} */ (body).email);
      const un = canonical(/** @type {{ username?: unknown }} */ (body).username);
      const pick = em || `u:${un}`;
      fp = pick ? hashForRateKey(`reg:${pick}`) : "";
      break;
    }
    case "/forgot-password": {
      const em = canonical(/** @type {{ email?: unknown }} */ (body).email);
      fp = em ? hashForRateKey(`pwd-forgot:${em}`) : "";
      break;
    }
    case "/request-verification-email/public": {
      const em = canonical(/** @type {{ email?: unknown }} */ (body).email);
      fp = em ? hashForRateKey(`verify-public:${em}`) : "";
      break;
    }
    case "/reset-password": {
      const tok =
        typeof /** @type {{ token?: unknown }} */ (body).token === "string"
          ? String(body.token).trim().slice(0, 128)
          : "";
      fp = tok ? hashForRateKey(`rst:${tok}`) : "";
      break;
    }
    default:
      fp = "";
  }

  /** Không có dấu tay → vẫn giới hạn theo IP (body lỗi / thiếu). */
  if (!fp) {
    return `auth-sens-ip:${ip}`;
  }
  return `auth-sens:${ip}:${fp}`;
}

const sensitiveAuthEndpointRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  skipSuccessfulRequests: false,
  handler(_req, res) {
    return res.status(429).json({
      success: false,
      message: "Quá nhiều yêu cầu đến bước đăng nhập / đăng ký. Vui lòng thử lại sau.",
      error: { code: "TOO_MANY_REQUESTS" },
    });
  },
});

export { sensitiveAuthEndpointRateLimit };
