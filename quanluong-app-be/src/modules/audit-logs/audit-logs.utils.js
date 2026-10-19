const MAX_RANGE_DAYS = 92;
const DEFAULT_RANGE_DAYS = 7;
const VN_OFFSET = "+07:00";

/** Khoảng thời gian (ngày theo giờ Việt Nam). Mặc định 7 ngày gần nhất; tối đa 92 ngày. */
function resolveRange({ from, to } = {}, now = new Date()) {
  const end = to ? new Date(`${to}T23:59:59.999${VN_OFFSET}`) : now;
  const start = from
    ? new Date(`${from}T00:00:00.000${VN_OFFSET}`)
    : new Date(end.getTime() - DEFAULT_RANGE_DAYS * 86400000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    const err = new Error("Khoảng thời gian không hợp lệ.");
    err.statusCode = 400;
    throw err;
  }
  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * 86400000) {
    const err = new Error(`Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày.`);
    err.statusCode = 400;
    throw err;
  }
  return { gte: start, lte: end };
}

/** WHERE theo phạm vi đơn vị: "all" (superadmin, UNIT_SCOPE_MODES.ALL) = mọi dòng kể cả unitId null; còn lại chỉ unitId trong nhánh. */
function scopeWhere(scope) {
  if (!scope || scope.mode === "all") return {};
  if (!scope.unitIds?.length) return { unitId: { in: [-1] } };
  return { unitId: { in: scope.unitIds } };
}

function cursorWhere(cursor) {
  return cursor ? { id: { lt: BigInt(cursor) } } : {};
}

function nextCursor(rows, limit) {
  return rows.length === limit ? String(rows[rows.length - 1].id) : null;
}

export { cursorWhere, DEFAULT_RANGE_DAYS, MAX_RANGE_DAYS, nextCursor, resolveRange, scopeWhere };
