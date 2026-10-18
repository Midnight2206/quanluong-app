import { prisma as defaultPrisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  BA_MAX_CONTENT_BYTES,
  BA_SCOPES,
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
    select: { id: true, scope: true, unitId: true, revokedAt: true, name: true },
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
          pushedByTokenId: token.id,
        },
        select: { id: true, unitId: true, version: true },
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
    select: { ...listSelect, contentMarkdown: true },
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
  if (scope === BA_SCOPES.GLOBAL_READ) throw forbidden("Chỉ superadmin quản lý mã khóa GLOBAL_READ.");
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

export {
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
