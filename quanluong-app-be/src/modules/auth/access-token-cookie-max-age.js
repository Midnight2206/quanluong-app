import ms from "ms";

const DEFAULT_JWT_MS = 15 * 60 * 1000;

function tryParseMs(value) {
  if (value == null || value === "") {
    return undefined;
  }
  try {
    const n = ms(String(value).trim());
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

/**
 * maxAge (ms) cho cookie access token — cùng quy tắc thời lượng với jwt.sign `expiresIn` (dùng gói `ms`).
 * Trừ vài giây so với TTL JWT để cookie hết hạn gần lúc JWT không còn verify được.
 * Không được throw: lỗi env (chuỗi rỗng / sai) không được làm crash app khi import auth.constants.
 */
function accessTokenExpiresInToCookieMaxAgeMs(expiresIn) {
  let raw = expiresIn != null ? String(expiresIn).trim() : "";
  if (!raw) {
    raw = "15m";
  }

  let jwtMs = tryParseMs(raw);
  if (jwtMs == null && /^\d+$/.test(raw)) {
    jwtMs = Number.parseInt(raw, 10) * 1000;
  }
  if (jwtMs == null || !Number.isFinite(jwtMs) || jwtMs <= 0) {
    jwtMs = DEFAULT_JWT_MS;
  }

  let out = jwtMs <= 10_000 ? Math.max(1000, jwtMs - 1000) : jwtMs - 5000;
  if (!Number.isFinite(out) || out <= 0) {
    out = DEFAULT_JWT_MS;
  }
  return out;
}

export { accessTokenExpiresInToCookieMaxAgeMs };
