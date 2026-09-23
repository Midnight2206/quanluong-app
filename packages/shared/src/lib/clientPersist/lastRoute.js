import { idbGet, idbPut, STORE } from "./db.js";
import { lastRouteKey } from "./keys.js";

/**
 * Soft landings — safe to replace with last private route after login / reopen home.
 * Deep links are never overridden.
 */
export const SOFT_LANDING_PATHS = new Set(["/", "/dashboard"]);

/**
 * @param {string} pathname
 * @param {string} [search] — with or without leading `?`
 */
export function buildRouteHref(pathname, search = "") {
  const path = pathname || "/";
  if (!search || search === "?") {
    return path;
  }
  return search.startsWith("?") ? `${path}${search}` : `${path}?${search}`;
}

/**
 * @param {string | null | undefined} href
 * @returns {{ pathname: string, search: string } | null}
 */
export function parseRouteHref(href) {
  if (href == null || typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) {
    return null;
  }
  const q = href.indexOf("?");
  if (q < 0) {
    return { pathname: href, search: "" };
  }
  return { pathname: href.slice(0, q) || "/", search: href.slice(q) };
}

export async function getLastRoute(userId) {
  const id = lastRouteKey(userId);
  const record = await idbGet(STORE.pageUi, id);
  const href = record?.fields?.href;
  return typeof href === "string" && href.startsWith("/") ? href : null;
}

export async function setLastRoute(userId, href) {
  if (userId == null || href == null || typeof href !== "string") {
    return;
  }
  if (!href.startsWith("/") || href.startsWith("//")) {
    return;
  }
  const id = lastRouteKey(userId);
  await idbPut(STORE.pageUi, {
    id,
    userId: Number(userId),
    routeKey: "lastRoute",
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    fields: { href },
  });
}

/**
 * @param {string} currentPathname
 * @param {string | null} lastHref
 */
export function shouldRestoreLastRoute(currentPathname, lastHref) {
  if (!lastHref) {
    return false;
  }
  const parsed = parseRouteHref(lastHref);
  if (!parsed) {
    return false;
  }
  if (!SOFT_LANDING_PATHS.has(currentPathname)) {
    return false;
  }
  if (SOFT_LANDING_PATHS.has(parsed.pathname) && !parsed.search) {
    return false;
  }
  return buildRouteHref(currentPathname, "") !== lastHref;
}
