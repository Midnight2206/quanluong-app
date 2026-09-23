/** In-memory route → field keys for local-unsaved UI marks (survives route remount). */
const byRoute = new Map();

function routeSet(routeKey) {
  let set = byRoute.get(routeKey);
  if (!set) {
    set = new Set();
    byRoute.set(routeKey, set);
  }
  return set;
}

export function markLocalUnsavedField(routeKey, fieldKey) {
  if (!routeKey || !fieldKey) {
    return;
  }
  routeSet(routeKey).add(String(fieldKey));
}

export function unmarkLocalUnsavedField(routeKey, fieldKey) {
  if (!routeKey || !fieldKey) {
    return;
  }
  const set = byRoute.get(routeKey);
  if (!set) {
    return;
  }
  set.delete(String(fieldKey));
  if (set.size === 0) {
    byRoute.delete(routeKey);
  }
}

export function listLocalUnsavedFields(routeKey) {
  const set = byRoute.get(routeKey);
  return set ? [...set] : [];
}

export function clearLocalUnsavedFieldsForRoute(routeKey) {
  if (routeKey) {
    byRoute.delete(routeKey);
  }
}

export function clearLocalUnsavedFieldRegistry() {
  byRoute.clear();
}
