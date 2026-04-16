import { env } from "./env.js";

const MIN_AUTH_SECRET_LENGTH = 32;

const BLOCKED_SECRET_FRAGMENTS = ["change-me", "changeme"];

function normalizeSecret(value) {
  return String(value ?? "").trim();
}

function isUnsafeAuthSecret(secret) {
  const s = normalizeSecret(secret);
  if (s.length < MIN_AUTH_SECRET_LENGTH) {
    return true;
  }
  const lower = s.toLowerCase();
  return BLOCKED_SECRET_FRAGMENTS.some((frag) => lower.includes(frag));
}

const WEAK_SUPERADMIN_PASSWORDS = new Set([
  "changeme123!",
  "changeme123",
  "password",
  "admin",
  "superadmin",
]);

function isUnsafeSuperadminPasswordForProduction(password) {
  const s = String(password ?? "").trim();
  if (s.length < 12) {
    return true;
  }
  const lower = s.toLowerCase();
  if (WEAK_SUPERADMIN_PASSWORDS.has(lower)) {
    return true;
  }
  if (lower.includes("changeme")) {
    return true;
  }
  return false;
}

/**
 * Chặn khởi động production với secret mẫu / quá ngắn.
 * Bootstrap superadmin: nếu bật, mật khẩu phải đủ mạnh; sau khi đã có superadmin nên tắt bootstrap.
 */
function assertProductionEnvSafety() {
  if (env.nodeEnv !== "production") {
    return;
  }

  if (isUnsafeAuthSecret(env.jwtAccessSecret)) {
    throw new Error(
      "[production] JWT_ACCESS_SECRET must be at least 32 characters and must not use sample values (e.g. change-me). Generate: openssl rand -hex 32",
    );
  }

  if (isUnsafeAuthSecret(env.sessionSecret)) {
    throw new Error(
      "[production] SESSION_SECRET must be at least 32 characters and must not use sample values. Generate: openssl rand -hex 32",
    );
  }

  if (
    env.runSuperadminBootstrap &&
    isUnsafeSuperadminPasswordForProduction(env.superadminPassword)
  ) {
    throw new Error(
      "[production] With RUN_SUPERADMIN_BOOTSTRAP=true, SUPERADMIN_PASSWORD must be strong (≥12 chars, not a common/changeme pattern). After the superadmin exists, set RUN_SUPERADMIN_BOOTSTRAP=false.",
    );
  }
}

export { assertProductionEnvSafety };
