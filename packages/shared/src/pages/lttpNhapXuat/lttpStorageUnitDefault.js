/** Tên đơn vị kho cấp phát LTTP mẫu dev — khớp seed `SAMPLE_CHILD_UNIT_NAME`. */
export const LTTP_STORAGE_UNIT_NAME = "Đơn vị mẫu cấp 2";

export function sortUnitsByPath(units) {
  return [...(units || [])].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

function normalizePathPrefix(path) {
  if (!path) return "";
  return path.endsWith("/") ? path : `${path}/`;
}

/** Gốc + mọi đơn vị con trong nhánh (khớp scope SUBTREE API). */
export function unitsWithinSubtree(allUnits, rootId) {
  if (rootId == null || !allUnits?.length) return [];
  const root = allUnits.find((u) => Number(u.id) === Number(rootId));
  if (!root) {
    return [{ id: rootId, name: `Đơn vị #${rootId}` }];
  }
  const pref = normalizePathPrefix(root.path || "");
  if (!pref) {
    return allUnits.filter((u) => Number(u.id) === Number(rootId));
  }
  return allUnits.filter(
    (u) =>
      Number(u.id) === Number(rootId) ||
      (typeof u.path === "string" && u.path.startsWith(pref)),
  );
}

/**
 * Đơn vị hiển thị trong dropdown (kho cấp phát, đơn vị nhận, …): toàn nhánh user hoặc toàn hệ thống.
 */
export function unitsForLttpUnitPicker(allUnits, { defaultUnitId, isPrivileged, userUnitName }) {
  if (!isPrivileged && defaultUnitId != null) {
    const rows = unitsWithinSubtree(allUnits, defaultUnitId);
    const sorted = sortUnitsByPath(rows);
    if (sorted.length > 0) {
      return sorted;
    }
    return [{ id: defaultUnitId, name: userUnitName ?? `Đơn vị #${defaultUnitId}` }];
  }
  return sortUnitsByPath(allUnits);
}

/**
 * Kho cấp phát mặc định: «Đơn vị mẫu cấp 2» nếu có trong phạm vi, không ẩn đơn vị con khỏi dropdown.
 */
export function resolveDefaultLttpStorageUnitId(allowedUnits, fallbackUnitId) {
  const sorted = sortUnitsByPath(allowedUnits);
  const storage = sorted.find((u) => String(u.name ?? "") === LTTP_STORAGE_UNIT_NAME);
  if (storage) {
    return Number(storage.id);
  }
  if (fallbackUnitId != null && sorted.some((u) => Number(u.id) === Number(fallbackUnitId))) {
    return Number(fallbackUnitId);
  }
  return sorted.length ? Number(sorted[0].id) : fallbackUnitId != null ? Number(fallbackUnitId) : null;
}
