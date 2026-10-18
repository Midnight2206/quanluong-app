import crypto from "node:crypto";

const BA_TOKEN_PREFIX = "qlba_";
const BA_SCOPES = Object.freeze({ UNIT_PUSH: "UNIT_PUSH", GLOBAL_READ: "GLOBAL_READ" });
/** Giới hạn nội dung Markdown (byte UTF-8). Body JSON toàn app giới hạn 1 MB. */
const BA_MAX_CONTENT_BYTES = 950 * 1024;

function generateBaToken() {
  const raw = `${BA_TOKEN_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
  return { raw, tokenHash: hashBaToken(raw), prefix: raw.slice(0, 12) };
}

function hashBaToken(raw) {
  return crypto.createHash("sha256").update(String(raw), "utf8").digest("hex");
}

/** Lấy token từ header `Authorization: Bearer qlba_...`; trả null nếu không đúng dạng. */
function extractBaBearerToken(header) {
  const m = /^Bearer\s+(qlba_[A-Za-z0-9_-]{20,})\s*$/.exec(String(header || ""));
  return m ? m[1] : null;
}

const SECRET_PATTERNS = [
  { kind: "password", re: /(?:password|passwd|pwd|mật\s*khẩu|mat\s*khau)\s*[:=]\s*\S+/iu },
  { kind: "bearer", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/ },
  { kind: "private_key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { kind: "qlba_token", re: /qlba_[A-Za-z0-9_-]{8,}/ },
];

/** Trả danh sách loại bí mật phát hiện trong nội dung (rỗng = sạch). */
function detectSecrets(text) {
  const s = String(text || "");
  return SECRET_PATTERNS.filter((p) => p.re.test(s)).map((p) => p.kind);
}

/** Từ các bản ghi (đã sắp xếp bất kỳ) giữ bản version lớn nhất mỗi unitId. */
function pickLatestPerUnit(rows) {
  const best = new Map();
  for (const r of rows || []) {
    const cur = best.get(r.unitId);
    if (!cur || r.version > cur.version) best.set(r.unitId, r);
  }
  return [...best.values()].sort((a, b) => a.unitId - b.unitId);
}

/**
 * Xác định unitId được phép đọc lịch sử với token hiện tại.
 * GLOBAL_READ: unit bất kỳ; UNIT_PUSH: chỉ đơn vị của token.
 */
function canTokenReadUnit(token, unitId) {
  if (!token) return false;
  if (token.scope === BA_SCOPES.GLOBAL_READ) return true;
  return token.scope === BA_SCOPES.UNIT_PUSH && Number(token.unitId) === Number(unitId);
}

export {
  BA_MAX_CONTENT_BYTES,
  BA_SCOPES,
  BA_TOKEN_PREFIX,
  canTokenReadUnit,
  detectSecrets,
  extractBaBearerToken,
  generateBaToken,
  hashBaToken,
  pickLatestPerUnit,
};
