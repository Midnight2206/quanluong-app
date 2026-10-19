import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";

/** Bảng không ghi nhật ký thay đổi: chính các bảng nhật ký + nhiễu kỹ thuật (bộ đếm, token phiên, cache dẫn xuất, đánh dấu đã đọc). */
const DEFAULT_EXCLUDED_MODELS = [
  "AuthEventLog",
  "DataChangeLog",
  "UsageEvent",
  "UsageSessionDaily",
  "RefreshToken",
  "ChungTuDocNumberCounter",
  "LttpIssueSlipSerial",
  "KitchenReceiptSlipSerial",
  "ChatDirectReadState",
  "LttpAiCommodityHabit",
  "LttpAiAliasStat",
];

function excludedModels() {
  const extra = (process.env.AUDIT_EXCLUDE_MODELS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return new Set([...DEFAULT_EXCLUDED_MODELS, ...extra]);
}

/** Đọc khóa chính từ schema.prisma (DMMF runtime Prisma 7 không có isId). */
function parsePrimaryKeys(schemaText) {
  const out = {};
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(schemaText))) {
    const [, name, body] = m;
    const compound = body.match(/@@id\(\s*(?:fields:\s*)?\[([^\]]+)\]/);
    if (compound) {
      out[name] = compound[1].split(",").map((s) => s.trim());
      continue;
    }
    const idLine = body.split("\n").find((l) => /^\s*\w+\s+\S+.*\s@id(\s|$|\()/.test(l));
    out[name] = idLine ? [idLine.trim().split(/\s+/)[0]] : [];
  }
  return out;
}

function loadSchemaText() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../../prisma/schema.prisma"), path.resolve(process.cwd(), "prisma/schema.prisma")];
  for (const p of candidates) {
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      /* thử đường dẫn khác */
    }
  }
  return "";
}

let cached;
function getModelMeta() {
  if (cached) return cached;
  const pks = parsePrimaryKeys(loadSchemaText());
  const meta = new Map();
  for (const model of Prisma.dmmf?.datamodel?.models ?? []) {
    const scalar = new Set(model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum").map((f) => f.name));
    const relations = new Set(model.fields.filter((f) => f.kind === "object").map((f) => f.name));
    const pk = pks[model.name]?.length ? pks[model.name] : scalar.has("id") ? ["id"] : [];
    meta.set(model.name, { name: model.name, scalar, relations, pk, hasUnitId: scalar.has("unitId") });
  }
  cached = meta;
  return meta;
}

function delegateName(model) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

export { DEFAULT_EXCLUDED_MODELS, delegateName, excludedModels, getModelMeta, parsePrimaryKeys };
