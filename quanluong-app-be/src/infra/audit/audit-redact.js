import crypto from "node:crypto";

const SENSITIVE_RE = /[Pp]assword|[Pp]asswd|[Tt]oken|[Ss]ecret|[Hh]ash|^otp|[a-z]Otp|[Aa]pi_?[Kk]ey|[Cc]redential|[Pp]rivate_?[Kk]ey|[Cc]ookie/;
const MAX_TEXT = 2000;
const IGNORED_FIELDS = new Set(["updatedAt"]);
const REDACTED = "[ẩn]";

function isSensitiveField(name) {
  return SENSITIVE_RE.test(name);
}

function summarizeText(s) {
  const h = crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
  return `[văn bản ${s.length} ký tự, sha256:${h}]`;
}

/** Chuẩn hóa một giá trị để lưu JSON an toàn, gọn. */
function normalizeValue(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (typeof Buffer !== "undefined" && (Buffer.isBuffer(v) || v instanceof Uint8Array)) return `[bytes ${v.length}]`;
  if (typeof v === "object" && typeof v.toFixed === "function" && typeof v.d !== "undefined") return v.toString(); // Decimal
  if (typeof v === "string") return v.length > MAX_TEXT ? summarizeText(v) : v;
  if (typeof v === "object") {
    const s = JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));
    if (s && s.length > MAX_TEXT) return summarizeText(s);
    return JSON.parse(s ?? "null");
  }
  return v;
}

/** Ảnh chụp bản ghi: chỉ trường scalar, đã ẩn trường nhạy cảm. */
function snapshot(record, scalarFields) {
  if (!record || typeof record !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (scalarFields && !scalarFields.has(k)) continue;
    if (IGNORED_FIELDS.has(k)) continue;
    out[k] = isSensitiveField(k) ? (v == null ? null : REDACTED) : normalizeValue(v);
  }
  return out;
}

/** So sánh từng trường: { field: { from, to } } — trường nhạy cảm chỉ báo đã đổi. */
function diffRecords(before, after, scalarFields) {
  const changes = {};
  if (!after) return changes;
  for (const k of Object.keys(after)) {
    if (scalarFields && !scalarFields.has(k)) continue;
    if (IGNORED_FIELDS.has(k)) continue;
    if (before && !(k in before)) continue;
    const a = normalizeValue(before ? before[k] : undefined);
    const b = normalizeValue(after[k]);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    changes[k] = isSensitiveField(k)
      ? { from: a == null ? null : REDACTED, to: b == null ? null : REDACTED }
      : { from: a === undefined ? null : a, to: b };
  }
  return changes;
}

export { diffRecords, isSensitiveField, normalizeValue, REDACTED, snapshot };
