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

function dayRange(q) {
  const r = range(q);
  const d = (x) => new Date(`${new Date(x.getTime() + 7 * 3600000).toISOString().slice(0, 10)}T00:00:00.000Z`);
  return { gte: d(r.gte), lte: d(r.lte) };
}

/** Tổng thời gian sử dụng theo người dùng/ngày; phân trang offset (cursor = số dòng đã bỏ qua). */
async function listUsageDaily(scope, q, { cap } = {}) {
  const take = cap ?? q.limit;
  const skip = cap ? 0 : Number(q.cursor || 0);
  const rows = await prisma.usageSessionDaily.findMany({
    where: { ...scopeWhere(scope), day: dayRange(q), ...(q.userId ? { userId: q.userId } : {}) },
    orderBy: [{ day: "desc" }, { activeSec: "desc" }],
    skip,
    take,
  });
  const items = (await decorate(rows.map((r) => ({ ...r, id: `${r.userId}-${r.day.toISOString().slice(0, 10)}`, occurredAt: r.lastSeenAt }))))
    .map((r) => ({ ...r, day: r.day.toISOString().slice(0, 10) }));
  return { items, nextCursor: !cap && rows.length === take ? String(skip + take) : null };
}

async function listUsagePages(scope, q) {
  const start = new Date(`${q.day}T00:00:00.000+07:00`);
  const end = new Date(start.getTime() + 86400000);
  const rows = await prisma.usageEvent.findMany({
    where: { ...scopeWhere(scope), userId: q.userId, occurredAt: { gte: start, lt: end }, ...(q.kind ? { kind: q.kind } : {}) },
    orderBy: { id: "asc" },
    take: 1000,
    omit: { sessionId: true },
  });
  return rows.map((r) => ({ ...r, id: String(r.id) }));
}

async function listUsageEvents(scope, q, { cap }) {
  const rows = await prisma.usageEvent.findMany({
    where: { ...scopeWhere(scope), occurredAt: range(q), ...(q.userId ? { userId: q.userId } : {}) },
    orderBy: { id: "desc" },
    take: cap,
    omit: { sessionId: true },
  });
  return { items: await decorate(rows), nextCursor: null };
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

export { decorate, getDataChange, listUsageDaily, listUsageEvents, listUsagePages, listAuthEvents, listDataChanges, listScopeUsers, range, userMap };
