import { prisma as defaultPrisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  BA_DOC_KEYS,
  BA_MAX_CONTENT_BYTES,
  BA_PUBLIC_DOC_KEY,
  BA_RULE_DOC_KEY,
  BA_SCOPES,
  GLOBAL_SCOPES,
  buildComparison,
  extractChungRuleIds,
  findUnknownChungRules,
  canTokenReadUnit,
  detectSecrets,
  generateBaToken,
  pickLatestPerUnit,
} from "./ba-profiles.utils.js";

const SUPERADMIN = "superadmin";
const ADMIN = "admin";

const tokenPublicSelect = {
  id: true,
  name: true,
  prefix: true,
  scope: true,
  unitId: true,
  createdByUserId: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
};

function forbidden(message) {
  return new AppError({ message, statusCode: 403, code: ERROR_CODES.FORBIDDEN });
}

async function findActiveTokenByHash(tokenHash, db = defaultPrisma) {
  return db.baApiToken.findFirst({
    where: { tokenHash, revokedAt: null },
    select: { id: true, scope: true, unitId: true, revokedAt: true, name: true, prefix: true },
  });
}

async function touchToken(id, db = defaultPrisma) {
  return db.baApiToken.update({ where: { id }, data: { lastUsedAt: new Date() } });
}

function assertCleanContent(contentMarkdown) {
  const bytes = Buffer.byteLength(String(contentMarkdown || ""), "utf8");
  if (bytes > BA_MAX_CONTENT_BYTES) {
    throw new AppError({
      message: `Nội dung vượt quá ${BA_MAX_CONTENT_BYTES} byte.`,
      statusCode: 413,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const found = detectSecrets(contentMarkdown);
  if (found.length) {
    throw new AppError({
      message: "Hồ sơ có vẻ chứa thông tin bí mật (mật khẩu, token, khóa riêng). Hãy xoá rồi đẩy lại.",
      statusCode: 422,
      code: ERROR_CODES.VALIDATION_ERROR,
      details: { secretKinds: found },
    });
  }
}

/** Đẩy phiên bản mới; unitId luôn lấy từ token. */
async function pushUnitProfile({ token, body }, db = defaultPrisma) {
  if (token?.scope !== BA_SCOPES.UNIT_PUSH || !token.unitId) {
    throw forbidden("Chỉ mã khóa UNIT_PUSH được đẩy hồ sơ.");
  }
  assertCleanContent(body.contentMarkdown);
  let rules = null;
  let baselineVersion = null;
  if (Array.isArray(body.rules) && body.rules.length) {
    assertCleanContent(JSON.stringify(body.rules));
    const baseline = await getLatestBaselineDoc(BA_RULE_DOC_KEY, db);
    const unknown = findUnknownChungRules(body.rules, baseline?.ruleIds);
    if (unknown.length) {
      throw new AppError({
        message: baseline
          ? "Có ruleId CHUNG-xx không có trong bộ nghiệp vụ chung mới nhất."
          : "Chưa có bộ nghiệp vụ chung để đối chiếu CHUNG-xx.",
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { unknownRuleIds: unknown, baselineVersion: baseline?.version ?? null },
      });
    }
    rules = body.rules.map((r) => ({
      ruleId: r.ruleId,
      status: r.status,
      note: r.note ?? null,
      evidence: r.evidence ?? null,
    }));
    baselineVersion = baseline?.version ?? null;
  }
  const unitId = Number(token.unitId);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const agg = await db.baUnitProfile.aggregate({ where: { unitId }, _max: { version: true } });
    const version = (agg?._max?.version ?? 0) + 1;
    try {
      const row = await db.baUnitProfile.create({
        data: {
          unitId,
          version,
          title: body.title,
          contentMarkdown: body.contentMarkdown,
          schemaVersion: body.schemaVersion,
          sourceAgentName: body.sourceAgentName ?? null,
          ...(rules ? { rules, baselineVersion } : {}),
          pushedByTokenId: token.id,
        },
        select: { id: true, unitId: true, version: true, baselineVersion: true },
      });
      return row;
    } catch (error) {
      if (error?.code !== "P2002" || attempt === 2) throw error;
    }
  }
  return null;
}

const listSelect = {
  id: true,
  unitId: true,
  version: true,
  title: true,
  schemaVersion: true,
  sourceAgentName: true,
  baselineVersion: true,
  createdAt: true,
  unit: { select: { name: true } },
};

function mapListRow(r) {
  const { unit, ...rest } = r;
  return { ...rest, unitName: unit?.name ?? null };
}

async function listLatestProfiles(db = defaultPrisma) {
  const rows = await db.baUnitProfile.findMany({ select: listSelect });
  return pickLatestPerUnit(rows).map(mapListRow);
}

async function listUnitHistory(unitId, db = defaultPrisma) {
  const rows = await db.baUnitProfile.findMany({
    where: { unitId: Number(unitId) },
    select: listSelect,
    orderBy: { version: "desc" },
  });
  return rows.map(mapListRow);
}

async function getProfileById(id, db = defaultPrisma) {
  const row = await db.baUnitProfile.findUnique({
    where: { id: Number(id) },
    select: { ...listSelect, contentMarkdown: true, rules: true },
  });
  if (!row) {
    throw new AppError({ message: "Không tìm thấy hồ sơ.", statusCode: 404, code: ERROR_CODES.NOT_FOUND });
  }
  return mapListRow(row);
}

/** Đọc qua token: GLOBAL_READ đọc mọi đơn vị; UNIT_PUSH chỉ đơn vị mình. */
function assertTokenCanReadUnit(token, unitId) {
  if (!canTokenReadUnit(token, unitId)) throw forbidden("Mã khóa không được đọc hồ sơ đơn vị này.");
}

// ---------- Quản lý token qua đăng nhập người dùng ----------

function userTypeName(user) {
  return user?.type?.name;
}

/** Kiểm tra quyền tạo/xem/thu hồi token theo scope + unit. */
function assertUserCanManage(user, { scope, unitId }) {
  const t = userTypeName(user);
  if (t === SUPERADMIN) return;
  if (GLOBAL_SCOPES.includes(scope)) throw forbidden("Chỉ superadmin quản lý mã khóa GLOBAL_READ / GLOBAL_WRITE.");
  if (t !== ADMIN || !user.unitId || Number(user.unitId) !== Number(unitId)) {
    throw forbidden("Chỉ admin đơn vị quản lý mã khóa đẩy hồ sơ của đơn vị mình.");
  }
}

async function createToken({ user, name, scope }, db = defaultPrisma) {
  const unitId = scope === BA_SCOPES.UNIT_PUSH ? user?.unitId ?? null : null;
  if (scope === BA_SCOPES.UNIT_PUSH && !unitId) {
    throw forbidden("Tài khoản chưa gắn đơn vị nên không tạo được mã khóa đẩy hồ sơ.");
  }
  assertUserCanManage(user, { scope, unitId });
  const { raw, tokenHash, prefix } = generateBaToken();
  const row = await db.baApiToken.create({
    data: { name, scope, unitId, tokenHash, prefix, createdByUserId: user.id },
    select: tokenPublicSelect,
  });
  return { ...row, token: raw };
}

async function listTokens({ user }, db = defaultPrisma) {
  const t = userTypeName(user);
  let where;
  if (t === SUPERADMIN) where = {};
  else if (t === ADMIN && user.unitId) where = { scope: BA_SCOPES.UNIT_PUSH, unitId: Number(user.unitId) };
  else throw forbidden("Chỉ admin đơn vị hoặc superadmin xem được mã khóa BA.");
  return db.baApiToken.findMany({ where, select: tokenPublicSelect, orderBy: { createdAt: "desc" } });
}

async function revokeToken({ user, id }, db = defaultPrisma) {
  const row = await db.baApiToken.findUnique({ where: { id: Number(id) }, select: tokenPublicSelect });
  if (!row) {
    throw new AppError({ message: "Không tìm thấy mã khóa.", statusCode: 404, code: ERROR_CODES.NOT_FOUND });
  }
  assertUserCanManage(user, { scope: row.scope, unitId: row.unitId });
  if (row.revokedAt) return row;
  return db.baApiToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
    select: tokenPublicSelect,
  });
}

// ---------- Bộ nghiệp vụ chung ----------

const baselineListSelect = { id: true, docKey: true, version: true, title: true, publishedBy: true, createdAt: true };

function notFound(message) {
  return new AppError({ message, statusCode: 404, code: ERROR_CODES.NOT_FOUND });
}

async function getLatestBaselineDoc(docKey, db = defaultPrisma) {
  return db.baBaselineDoc.findFirst({ where: { docKey }, orderBy: { version: "desc" } });
}

/** Bản mới nhất của mỗi docKey (kèm nội dung — bộ kit nhỏ). */
async function listLatestBaseline(db = defaultPrisma) {
  const out = [];
  for (const docKey of BA_DOC_KEYS) {
    const row = await getLatestBaselineDoc(docKey, db);
    if (row) out.push(row);
  }
  return out;
}

/** Dữ liệu cho GET /api/ba/start: nội dung `huong-dan` mới nhất + siêu dữ liệu các docKey khác (không nội dung). */
async function getStartGuideData(db = defaultPrisma) {
  const guide = await getLatestBaselineDoc(BA_PUBLIC_DOC_KEY, db);
  const docs = [];
  for (const docKey of BA_DOC_KEYS) {
    const row = await db.baBaselineDoc.findFirst({ where: { docKey }, orderBy: { version: "desc" }, select: baselineListSelect });
    if (row) docs.push(row);
  }
  return { guide, docs };
}

async function getBaselineDoc(docKey, version, db = defaultPrisma) {
  const row = version
    ? await db.baBaselineDoc.findUnique({ where: { docKey_version: { docKey, version: Number(version) } } })
    : await getLatestBaselineDoc(docKey, db);
  if (!row) throw notFound("Chưa có tài liệu này trong bộ nghiệp vụ chung.");
  return row;
}

async function listBaselineVersions(docKey, db = defaultPrisma) {
  return db.baBaselineDoc.findMany({ where: { docKey }, select: baselineListSelect, orderBy: { version: "desc" } });
}

/** Đăng phiên bản mới; `actor` = "user:<id>" | "token:<prefix>". */
async function publishBaselineDoc({ docKey, title, contentMarkdown, actor }, db = defaultPrisma) {
  assertCleanContent(contentMarkdown);
  const ruleIds = docKey === BA_RULE_DOC_KEY ? extractChungRuleIds(contentMarkdown) : null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const agg = await db.baBaselineDoc.aggregate({ where: { docKey }, _max: { version: true } });
    const version = (agg?._max?.version ?? 0) + 1;
    try {
      return await db.baBaselineDoc.create({
        data: { docKey, version, title, contentMarkdown, ruleIds, publishedBy: actor ?? null },
        select: { ...baselineListSelect, ruleIds: true },
      });
    } catch (error) {
      if (error?.code !== "P2002" || attempt === 2) throw error;
    }
  }
  return null;
}

// ---------- Bảng so sánh ----------

async function getComparison(db = defaultPrisma) {
  const baseline = await getLatestBaselineDoc(BA_RULE_DOC_KEY, db);
  const rows = await db.baUnitProfile.findMany({ select: { ...listSelect, rules: true } });
  const latest = pickLatestPerUnit(rows).map(mapListRow);
  return {
    baselineVersion: baseline?.version ?? null,
    ...buildComparison(Array.isArray(baseline?.ruleIds) ? baseline.ruleIds : [], latest),
  };
}

// ---------- Đề xuất ----------

const proposalSelect = {
  id: true,
  unitId: true,
  title: true,
  description: true,
  relatedRuleIds: true,
  proposedText: true,
  status: true,
  reviewComment: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  unit: { select: { name: true } },
};

async function createProposal({ token, body }, db = defaultPrisma) {
  if (token?.scope !== BA_SCOPES.UNIT_PUSH || !token.unitId) {
    throw forbidden("Chỉ mã khóa UNIT_PUSH được gửi đề xuất.");
  }
  assertCleanContent([body.title, body.description, body.proposedText].join("\n"));
  const row = await db.baProposal.create({
    data: {
      unitId: Number(token.unitId),
      title: body.title,
      description: body.description ?? null,
      relatedRuleIds: body.relatedRuleIds ?? [],
      proposedText: body.proposedText,
      createdByTokenId: token.id ?? null,
    },
    select: proposalSelect,
  });
  return mapListRow(row);
}

/** UNIT_PUSH: chỉ đề xuất của đơn vị mình; GLOBAL: tất cả. */
async function listProposals({ token, status }, db = defaultPrisma) {
  const where = {};
  if (status) where.status = status;
  if (!GLOBAL_SCOPES.includes(token?.scope)) {
    if (token?.scope !== BA_SCOPES.UNIT_PUSH || !token.unitId) throw forbidden("Mã khóa không đọc được đề xuất.");
    where.unitId = Number(token.unitId);
  }
  const rows = await db.baProposal.findMany({ where, select: proposalSelect, orderBy: { createdAt: "desc" } });
  return rows.map(mapListRow);
}

async function reviewProposal({ id, status, reviewComment, actor }, db = defaultPrisma) {
  const found = await db.baProposal.findUnique({ where: { id: Number(id) }, select: { id: true } });
  if (!found) throw notFound("Không tìm thấy đề xuất.");
  const row = await db.baProposal.update({
    where: { id: found.id },
    data: {
      status,
      reviewComment: reviewComment ?? null,
      reviewedBy: actor ?? null,
      reviewedAt: status === "OPEN" ? null : new Date(),
    },
    select: proposalSelect,
  });
  return mapListRow(row);
}

export {
  createProposal,
  getBaselineDoc,
  getStartGuideData,
  getComparison,
  getLatestBaselineDoc,
  listBaselineVersions,
  listLatestBaseline,
  listProposals,
  publishBaselineDoc,
  reviewProposal,
  assertCleanContent,
  assertTokenCanReadUnit,
  assertUserCanManage,
  createToken,
  findActiveTokenByHash,
  getProfileById,
  listLatestProfiles,
  listTokens,
  listUnitHistory,
  pushUnitProfile,
  revokeToken,
  touchToken,
};
