import { createHmac, timingSafeEqual } from "crypto";

/** Cookie sau khi nhập mật khẩu đúng (httpOnly) — dùng HMAC, không lưu mật khẩu. */
export const MIDNIGHT_GATE_COOKIE = "ql.mid";
export const MIDNIGHT_GATE_MAX_AGE_SECONDS = 30 * 60;
const MIDNIGHT_GATE_VERSION = 2;
const DEFAULT_ACCESS_COOKIE = "ql.at";
const DEFAULT_REFRESH_COOKIE = "ql.rt";

function getAuthCookieNames() {
  return {
    access: process.env.ACCESS_TOKEN_COOKIE_NAME || DEFAULT_ACCESS_COOKIE,
    refresh: process.env.REFRESH_TOKEN_COOKIE_NAME || DEFAULT_REFRESH_COOKIE,
  };
}

function parseCookieHeader(cookieHeader) {
  const out = new Map();
  for (const part of String(cookieHeader || "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const name = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    try {
      out.set(name, decodeURIComponent(value));
    } catch {
      out.set(name, value);
    }
  }
  return out;
}

function getAuthCookieFingerprint(cookieHeader) {
  const cookies = parseCookieHeader(cookieHeader);
  const { access, refresh } = getAuthCookieNames();
  const accessToken = cookies.get(access) || "";
  const refreshToken = cookies.get(refresh) || "";
  if (!accessToken && !refreshToken) {
    return null;
  }
  return createHmac("sha256", "midnight-auth-cookie-v1")
    .update(accessToken)
    .update("\n")
    .update(refreshToken)
    .digest("base64url");
}

function signMidnightGatePayload(payload) {
  const s = process.env.MIDNIGHT_SECRET_PASSWORD;
  if (s == null || String(s).trim() === "") {
    return null;
  }
  return createHmac("sha256", s).update(payload).digest("base64url");
}

function safeEqualString(a, b) {
  try {
    return timingSafeEqual(Buffer.from(String(a), "utf8"), Buffer.from(String(b), "utf8"));
  } catch {
    return false;
  }
}

export function getMidnightGateCookieValue(cookieHeader, nowMs = Date.now()) {
  const fp = getAuthCookieFingerprint(cookieHeader);
  if (!fp) {
    return null;
  }
  const payload = Buffer.from(
    JSON.stringify({
      v: MIDNIGHT_GATE_VERSION,
      exp: nowMs + MIDNIGHT_GATE_MAX_AGE_SECONDS * 1000,
      fp,
    }),
    "utf8",
  ).toString("base64url");
  const sig = signMidnightGatePayload(payload);
  if (!sig) {
    return null;
  }
  return `${payload}.${sig}`;
}

/**
 * @param {string | undefined} value
 * @param {string | undefined} cookieHeader
 * @returns {boolean}
 */
export function isMidnightGateCookieValid(value, cookieHeader, nowMs = Date.now()) {
  if (!value || !String(value).includes(".")) {
    return false;
  }
  const [payload, sig] = String(value).split(".");
  if (!payload || !sig) {
    return false;
  }
  const expectedSig = signMidnightGatePayload(payload);
  if (!expectedSig || !safeEqualString(sig, expectedSig)) {
    return false;
  }
  const fp = getAuthCookieFingerprint(cookieHeader);
  if (!fp) {
    return false;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return (
      data?.v === MIDNIGHT_GATE_VERSION &&
      Number.isFinite(data?.exp) &&
      data.exp > nowMs &&
      typeof data?.fp === "string" &&
      safeEqualString(data.fp, fp)
    );
  } catch {
    return false;
  }
}

export function buildCookieHeaderFromStore(cookieStore) {
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");
}

export function getBackendBaseForMidnight() {
  const b = process.env.API_BASE_URL_INTERNAL;
  if (b && String(b).trim() !== "") {
    return String(b).replace(/\/$/, "");
  }
  return "http://localhost:3000/api";
}

export function getMidnightSecretHeader() {
  const s = process.env.MIDNIGHT_SECRET_PASSWORD;
  if (s == null || String(s).trim() === "") {
    return null;
  }
  return s;
}

export async function getCurrentUserUnitIdForMidnight(cookieHeader) {
  const base = getBackendBaseForMidnight();
  const r = await fetch(`${base}/auth/current-user`, {
    headers: { Cookie: cookieHeader || "" },
    cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    return { error: json, status: r.status };
  }
  const unitId = Number(json?.data?.unit?.id);
  if (!Number.isInteger(unitId) || unitId <= 0) {
    return {
      error: { success: false, error: { message: "Tài khoản hiện tại chưa gắn đơn vị" } },
      status: 403,
    };
  }
  return { unitId };
}
