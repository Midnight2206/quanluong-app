export function pageUiKey(userId, routeKey) {
  return `${Number(userId)}|${String(routeKey)}`;
}

/**
 * Normalize draft scope for IDB key. Numeric unit ids stay decimal strings ("3");
 * non-numeric scopes ("global", "cat:bkmh") pass through as-is.
 * @param {number | string | null | undefined} scopeId
 * @returns {string | null}
 */
export function normalizeDraftScopeId(scopeId) {
  if (scopeId == null || scopeId === "") {
    return null;
  }
  if (typeof scopeId === "number") {
    return Number.isFinite(scopeId) ? String(scopeId) : null;
  }
  const s = String(scopeId);
  if (/^\d+$/.test(s)) {
    return s;
  }
  return s;
}

/** @param {number | string | null | undefined} scopeId — unit id or string scope (alias: unitId). */
export function draftKey(userId, draftType, scopeId) {
  const scope = normalizeDraftScopeId(scopeId);
  return `${Number(userId)}|${String(draftType)}|${scope}`;
}

/** Nav tab persist id (string persistId — not unit-scoped like draftKey). */
export function navTabKey(userId, persistId) {
  return `${Number(userId)}|navTab|${String(persistId)}`;
}

/** Shell last-route bookmark (one per user). */
export function lastRouteKey(userId) {
  return `${Number(userId)}|lastRoute`;
}
