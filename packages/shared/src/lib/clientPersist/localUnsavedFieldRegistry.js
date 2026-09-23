/** In-memory + sessionStorage registry of local-unsaved field/section keys (survives hard refresh). */

const STORAGE_KEY = "quanluong:local-unsaved-fields";

/** @type {Map<string, Set<string>>} */
const byRoute = new Map();

function persist() {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    /** @type {Record<string, string[]>} */
    const obj = {};
    for (const [route, set] of byRoute) {
      if (set.size > 0) {
        obj[route] = [...set];
      }
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* ignore quota / private mode */
  }
}

function hydrateFromStorage() {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") {
      return;
    }
    byRoute.clear();
    for (const [route, keys] of Object.entries(obj)) {
      if (!Array.isArray(keys)) {
        continue;
      }
      byRoute.set(route, new Set(keys.map(String)));
    }
  } catch {
    /* ignore */
  }
}

hydrateFromStorage();

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
  persist();
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
  persist();
}

export function listLocalUnsavedFields(routeKey) {
  const set = byRoute.get(routeKey);
  return set ? [...set] : [];
}

export function clearLocalUnsavedFieldsForRoute(routeKey) {
  if (routeKey) {
    byRoute.delete(routeKey);
    persist();
  }
}

export function clearLocalUnsavedFieldRegistry() {
  byRoute.clear();
  persist();
}

/** @returns {Record<string, string[]>} */
export function dumpLocalUnsavedFieldRegistryForTest() {
  /** @type {Record<string, string[]>} */
  const obj = {};
  for (const [route, set] of byRoute) {
    obj[route] = [...set];
  }
  return obj;
}
