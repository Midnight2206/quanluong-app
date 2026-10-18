import crypto from "node:crypto";

const BA_TOKEN_PREFIX = "qlba_";
const BA_SCOPES = Object.freeze({
  UNIT_PUSH: "UNIT_PUSH",
  GLOBAL_READ: "GLOBAL_READ",
  GLOBAL_WRITE: "GLOBAL_WRITE",
});
const GLOBAL_SCOPES = [BA_SCOPES.GLOBAL_READ, BA_SCOPES.GLOBAL_WRITE];
const ALL_SCOPES = [BA_SCOPES.UNIT_PUSH, ...GLOBAL_SCOPES];
/** Tài liệu bộ nghiệp vụ chung; thứ tự = thứ tự hiển thị. */
const BA_DOC_KEYS = ["huong-dan", "nghiep-vu-chung", "mau-ho-so", "bo-cau-hoi"];
const BA_RULE_DOC_KEY = "nghiep-vu-chung";
const BA_RULE_STATUSES = ["GIONG", "KHAC", "NA", "CHUA_RO"];
const BA_EVIDENCE = ["QS", "CHAT", "SUY", "CHU"];
const CHUNG_ID_RE = /^CHUNG-\d{2,3}$/;
const RIENG_ID_RE = /^RIENG-\d{2,3}$/;
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
  if (GLOBAL_SCOPES.includes(token.scope)) return true;
  return token.scope === BA_SCOPES.UNIT_PUSH && Number(token.unitId) === Number(unitId);
}

/** CHUNG-xx theo thứ tự xuất hiện đầu tiên trong Markdown. */
function extractChungRuleIds(markdown) {
  const seen = new Set();
  for (const m of String(markdown || "").matchAll(/\bCHUNG-\d{2,3}\b/g)) seen.add(m[0]);
  return [...seen];
}

/** Trả danh sách ruleId CHUNG-xx không có trong baseline (rỗng = hợp lệ). */
function findUnknownChungRules(rules, baselineRuleIds) {
  const known = new Set(baselineRuleIds || []);
  return (rules || []).map((r) => r.ruleId).filter((id) => CHUNG_ID_RE.test(id) && !known.has(id));
}

/**
 * Ma trận ruleId × đơn vị từ hồ sơ mới nhất mỗi đơn vị.
 * profiles: [{ id, unitId, unitName, version, createdAt, rules }]
 */
function buildComparison(baselineRuleIds, profiles) {
  const units = (profiles || []).map((p) => ({
    unitId: p.unitId,
    unitName: p.unitName ?? null,
    profileId: p.id,
    version: p.version,
    createdAt: p.createdAt,
  }));
  const byUnit = new Map();
  const riengByUnit = {};
  for (const p of profiles || []) {
    const map = new Map();
    for (const r of Array.isArray(p.rules) ? p.rules : []) {
      if (RIENG_ID_RE.test(r.ruleId)) (riengByUnit[p.unitId] ??= []).push(r);
      else map.set(r.ruleId, r);
    }
    byUnit.set(p.unitId, map);
  }
  const rules = (baselineRuleIds || []).map((ruleId) => {
    const cells = {};
    const counts = { GIONG: 0, KHAC: 0, NA: 0, CHUA_RO: 0, MISSING: 0 };
    for (const u of units) {
      const r = byUnit.get(u.unitId)?.get(ruleId);
      if (r) {
        cells[u.unitId] = { status: r.status, note: r.note ?? null, evidence: r.evidence ?? null };
        counts[r.status] += 1;
      } else {
        counts.MISSING += 1;
      }
    }
    const answered = units.length - counts.MISSING - counts.NA;
    return {
      ruleId,
      cells,
      counts,
      giongPercent: answered > 0 ? Math.round((counts.GIONG / answered) * 100) : null,
    };
  });
  return { units, rules, riengByUnit };
}

/** Tài liệu công khai qua GET /api/ba/start (không cần token). Các docKey khác vẫn cần token. */
const BA_PUBLIC_DOC_KEY = "huong-dan";
const BA_BASE_URL_PLACEHOLDER = "{{BASE_URL}}";

function normalizeBaseUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "").replace(/\/api$/, "");
}

/**
 * Dựng trang khởi động cho trợ lý BA từ bản `huong-dan` mới nhất.
 * guide: { version, title, contentMarkdown, createdAt } | null
 * docs: [{ docKey, version, title, createdAt }] — chỉ siêu dữ liệu, không nội dung.
 */
function buildStartGuide({ guide, docs, baseUrl }) {
  const base = normalizeBaseUrl(baseUrl);
  const content = guide ? String(guide.contentMarkdown || "").split(BA_BASE_URL_PLACEHOLDER).join(base) : null;
  const otherDocs = (docs || [])
    .filter((d) => d.docKey !== BA_PUBLIC_DOC_KEY)
    .map((d) => ({
      docKey: d.docKey,
      version: d.version,
      title: d.title,
      createdAt: d.createdAt,
      url: `${base}/api/ba/baseline/${d.docKey}`,
      auth: "Bearer UNIT_PUSH",
    }));
  const lines = [
    "",
    "---",
    "",
    "## Phụ lục (app tự sinh)",
    "",
    `- Địa chỉ gốc: \`QLBA_BASE_URL=${base}\``,
    `- Trang này: \`${base}/api/ba/start\` (công khai). JSON: \`${base}/api/ba/start?format=json\``,
    guide ? `- Phiên bản hướng dẫn: \`huong-dan\` v${guide.version}` : "- Chưa có hướng dẫn được đăng.",
    "",
    "Các tài liệu còn lại của bộ chung cần mã khóa (`Authorization: Bearer $QLBA_TOKEN`):",
    "",
    "| docKey | Phiên bản | Tiêu đề | Lấy bằng |",
    "|---|---|---|---|",
    ...otherDocs.map((d) => `| \`${d.docKey}\` | v${d.version} | ${String(d.title || "").replace(/\|/g, "/")} | \`GET ${d.url}\` |`),
    ...(otherDocs.length ? [] : ["| — | — | chưa đăng | — |"]),
    "",
    `Lấy cả bộ một lần: \`curl -sS "${base}/api/ba/baseline" -H "Authorization: Bearer $QLBA_TOKEN"\``,
    "",
  ];
  const markdown = `${content ?? "# Hướng dẫn trợ lý BA\n\nChưa có hướng dẫn được đăng. Báo chủ tài khoản liên hệ quản trị app rồi thử lại sau."}\n${lines.join("\n")}`;
  return {
    baseUrl: base,
    guide: guide ? { docKey: BA_PUBLIC_DOC_KEY, version: guide.version, title: guide.title, createdAt: guide.createdAt } : null,
    docs: otherDocs,
    markdown,
  };
}

export {
  BA_BASE_URL_PLACEHOLDER,
  BA_PUBLIC_DOC_KEY,
  buildStartGuide,
  normalizeBaseUrl,
  ALL_SCOPES,
  BA_DOC_KEYS,
  BA_EVIDENCE,
  BA_RULE_DOC_KEY,
  BA_RULE_STATUSES,
  CHUNG_ID_RE,
  GLOBAL_SCOPES,
  RIENG_ID_RE,
  buildComparison,
  extractChungRuleIds,
  findUnknownChungRules,
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
