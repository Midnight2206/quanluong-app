function pathPrefix(p) {
  if (!p) {
    return "";
  }
  return p.endsWith("/") ? p : `${p}/`;
}

/**
 * Đơn vị là **cấp dưới thật** của `ancestorUnitId` trong cùng danh sách (dựa vào `path` materialized).
 * @param {Array<{ id: number|string, path?: string|null, depth?: number, name?: string }>} allUnits
 */
export function listStrictDescendantUnits(allUnits, ancestorUnitId) {
  const aid = Number(ancestorUnitId);
  const ancestor = (allUnits || []).find((u) => Number(u.id) === aid);
  if (!ancestor?.path) {
    return [];
  }
  const pref = pathPrefix(ancestor.path);
  return (allUnits || []).filter((u) => {
    if (Number(u.id) === aid) {
      return false;
    }
    const p = u.path || "";
    return Boolean(p && p.startsWith(pref));
  });
}
