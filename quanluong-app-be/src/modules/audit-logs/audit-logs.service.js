import { basePrisma as prisma } from "../../infra/database/prisma/prisma.client.js";
import { displayIp } from "../../infra/audit/ip-mask.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { modelLabel } from "./audit-logs.labels.js";
import { cursorWhere, nextCursor, resolveRange, scopeWhere } from "./audit-logs.utils.js";

function range(q) {
  try {
    return resolveRange(q);
  } catch (e) {
    throw new AppError({ message: e.message, statusCode: 400, code: ERROR_CODES.VALIDATION_ERROR });
  }
}

async function userMap(ids) {
  const uniq = [...new Set(ids.filter((v) => v != null))];
  if (!uniq.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: uniq } },
    select: { id: true, username: true, profile: { select: { fullName: true } } },
  });
  return new Map(users.map((u) => [u.id, { username: u.username, fullName: u.profile?.fullName ?? null }]));
}

async function unitMap(ids) {
  const uniq = [...new Set(ids.filter((v) => v != null))];
  if (!uniq.length) return new Map();
  const units = await prisma.unit.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true } });
  return new Map(units.map((u) => [u.id, u.name]));
}

async function decorate(rows) {
  const [users, units] = await Promise.all([userMap(rows.map((r) => r.userId)), unitMap(rows.map((r) => r.unitId))]);
  return rows.map(({ sessionId: _sid, ...r }) => ({
    ...r,
    id: String(r.id),
    ip: r.ip !== undefined ? displayIp(r.ip, r.occurredAt) : undefined,
    user: r.userId != null ? users.get(r.userId) ?? null : null,
    unitName: r.unitId != null ? units.get(r.unitId) ?? null : null,
  }));
}

function authWhere(scope, q) {
  return {
    ...scopeWhere(scope),
    occurredAt: range(q),
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.type ? { type: q.type } : {}),
  };
}

async function listAuthEvents(scope, q, { cap } = {}) {
  const take = cap ?? q.limit;
  const rows = await prisma.authEventLog.findMany({
    where: { ...authWhere(scope, q), ...(cap ? {} : cursorWhere(q.cursor)) },
    orderBy: { id: "desc" },
    take,
  });
  return { items: await decorate(rows), nextCursor: cap ? null : nextCursor(rows, take) };
}

function changesWhere(scope, q) {
  return {
    ...scopeWhere(scope),
    occurredAt: range(q),
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.action ? { action: q.action } : {}),
    ...(q.model ? { model: q.model } : {}),
    ...(q.recordId ? { recordId: q.recordId } : {}),
  };
}

const withLabel = (r) => ({ ...r, modelLabel: modelLabel(r.model) });

async function listDataChanges(scope, q, { cap } = {}) {
  const take = cap ?? q.limit;
  const rows = await prisma.dataChangeLog.findMany({
    where: { ...changesWhere(scope, q), ...(cap ? {} : cursorWhere(q.cursor)) },
    orderBy: { id: "desc" },
    take,
    ...(cap ? {} : { omit: { changes: true } }),
  });
  return { items: (await decorate(rows)).map(withLabel), nextCursor: cap ? null : nextCursor(rows, take) };
}

async function getDataChange(scope, id) {
  const row = await prisma.dataChangeLog.findFirst({ where: { id: BigInt(id), ...scopeWhere(scope) } });
  if (!row) {
    throw new AppError({ message: "Không tìm thấy bản ghi nhật ký.", statusCode: 404, code: ERROR_CODES.NOT_FOUND });
  }
  const [item] = await decorate([row]);
  return withLabel(item);
}

async function listScopeUsers(scope) {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, ...scopeWhere(scope) },
    select: { id: true, username: true, profile: { select: { fullName: true } } },
    orderBy: { username: "asc" },
    take: 2000,
  });
  return users.map((u) => ({ id: u.id, username: u.username, fullName: u.profile?.fullName ?? null }));
}

export { decorate, getDataChange, listAuthEvents, listDataChanges, listScopeUsers, range, userMap };
