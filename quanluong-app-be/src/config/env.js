import path from "node:path";
import dotenv from "dotenv";
import { requireEnv } from "./require-env.js";

dotenv.config();

/** Chuẩn hóa origin từ env (trim, bỏ slash cuối). */
function normalizeCorsOrigin(value) {
  return value.trim().replace(/\/+$/, "");
}

/**
 * Với mỗi origin `http://localhost:PORT` hoặc `http://127.0.0.1:PORT`, thêm origin còn lại.
 * Trình duyệt coi localhost và 127.0.0.1 là hai origin khác nhau — Docker/UI thường mở bằng một trong hai.
 */
function expandLocalhostOriginPairs(origins) {
  const set = new Set(origins.filter(Boolean));
  for (const o of [...set]) {
    const localhostPort = /^http:\/\/localhost:(\d+)$/i.exec(o);
    if (localhostPort) {
      set.add(`http://127.0.0.1:${localhostPort[1]}`);
    }
    const loopbackPort = /^http:\/\/127\.0\.0\.1:(\d+)$/i.exec(o);
    if (loopbackPort) {
      set.add(`http://localhost:${loopbackPort[1]}`);
    }
  }
  return [...set];
}

/** Số ngày refresh token; NaN/≤0 → fallback (tránh Prisma lỗi khi đăng nhập). */
function envPositiveIntDays(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 3650) : fallback;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  appName: process.env.APP_NAME || "quanluong-app-be",
  port: Number(process.env.PORT || 3000),
  /** Cổng HTTP chỉ cho Socket.io (luồng tách API). 0 hoặc trùng PORT → gắn socket trên cùng server API. */
  socketPort: (() => {
    const raw = process.env.SOCKET_PORT;
    if (raw == null || String(raw).trim() === "") {
      return 0;
    }
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 && n < 65536 ? Math.floor(n) : 0;
  })(),
  databaseUrl: requireEnv("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL || "",
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  sessionSecret: requireEnv("SESSION_SECRET"),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "ql.sid",
  accessTokenCookieName: process.env.ACCESS_TOKEN_COOKIE_NAME || "ql.at",
  refreshTokenCookieName: process.env.REFRESH_TOKEN_COOKIE_NAME || "ql.rt",
  accessTokenExpiresIn: (() => {
    const t = (process.env.ACCESS_TOKEN_EXPIRES_IN || "15m").trim();
    return t || "15m";
  })(),
  refreshTokenExpiresDays: envPositiveIntDays(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 30),
  /**
   * Domain chung cho cookie httpOnly (vd. `.example.com`) khi UI app và superadmin là hai subdomain
   * cùng gọi API — trình duyệt mới gửi `ql.at` / `ql.rt` / `ql.sid` giữa các host con.
   * Để trống = host-only (mỗi origin một bộ cookie). Dev `:8080` / `:8081` không share được qua biến này.
   */
  cookieDomain: (() => {
    const raw = process.env.COOKIE_DOMAIN;
    if (raw == null || String(raw).trim() === "") {
      return undefined;
    }
    return String(raw).trim();
  })(),
  permissionSyncOnBoot: process.env.PERMISSION_SYNC_ON_BOOT !== "false",
  /** Chỉ chạy khi bật rõ ràng — tránh bootstrap superadmin lặp lại / phụ thuộc mặc định yếu. */
  runSuperadminBootstrap: process.env.RUN_SUPERADMIN_BOOTSTRAP === "true",
  superadminEmail: process.env.SUPERADMIN_EMAIL || "superadmin@quanluong.local",
  superadminUsername: process.env.SUPERADMIN_USERNAME || "superadmin",
  superadminPassword: process.env.SUPERADMIN_PASSWORD || "ChangeMe123!",
  superadminFullName: process.env.SUPERADMIN_FULL_NAME || "Super Admin",
  registrationRequiresApproval: process.env.REGISTRATION_REQUIRES_APPROVAL !== "false",
  minUnitDepthToApproveRegistration: Number(
    process.env.MIN_UNIT_DEPTH_TO_APPROVE_REGISTRATION ?? 0,
  ),
  /**
   * Giới hạn số HTTP request / IP / cửa sổ 15 phút cho toàn `/api` (express-rate-limit toàn app).
   * SPA + nhiều tab + cùng WiFi/NAT — 300 thường chật; mặc định nâng nhẹ; tinh chỉnh bằng env production.
   */
  globalApiRateLimitMax: (() => {
    const raw = process.env.GLOBAL_API_RATE_LIMIT_MAX;
    const n = raw == null || String(raw).trim() === "" ? 1200 : Number(raw);
    if (!Number.isFinite(n)) return 1200;
    return Math.min(200_000, Math.max(50, Math.floor(n)));
  })(),
  corsOrigins: (() => {
    const fromEnv = (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((value) => normalizeCorsOrigin(value))
      .filter(Boolean);
    const devDefaults = [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:8080",
      "http://localhost:8081",
    ];
    const base =
      process.env.NODE_ENV === "production"
        ? fromEnv
        : [...new Set([...fromEnv, ...devDefaults])];
    return expandLocalhostOriginPairs(base);
  })(),
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    from: process.env.SMTP_FROM || "",
  },
  /** smtp | gmail_api — gmail_api dùng Gmail API + GMAIL_SENDER_* (bật Gmail API trên GCP, scope gmail.send). */
  mailTransport: process.env.MAIL_TRANSPORT === "gmail_api" ? "gmail_api" : "smtp",
  gmailSenderRefreshToken: process.env.GMAIL_SENDER_REFRESH_TOKEN || "",
  gmailSenderEmail: process.env.GMAIL_SENDER_EMAIL || "",
  publicWebUrl: (process.env.PUBLIC_WEB_URL || "http://localhost:5173").replace(/\/+$/, ""),
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  /** Khớp tuyệt đối Google Console; bỏ khoảng trắng và slash cuối để tránh redirect_uri_mismatch. */
  googleRedirectUri: (process.env.GOOGLE_REDIRECT_URI || "").trim().replace(/\/+$/, ""),
  /** Thư mục gốc lưu file media (Docker: /data/media). Để trống → ./storage/media (relative cwd). */
  mediaRoot: process.env.MEDIA_ROOT?.trim()
    ? path.resolve(process.env.MEDIA_ROOT.trim())
    : path.resolve(process.cwd(), "storage", "media"),
  /** URL path phục vụ tĩnh (Nginx + optional express.static), ví dụ /media */
  mediaPublicPath: (() => {
    const p = (process.env.MEDIA_PUBLIC_PATH || "/media").trim().replace(/\/+$/, "") || "/media";
    return p.startsWith("/") ? p : `/${p}`;
  })(),
};

export { env };
