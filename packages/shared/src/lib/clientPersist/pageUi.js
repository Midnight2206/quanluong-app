import { idbGet, idbPut, STORE } from "./db.js";
import { navTabKey, pageUiKey } from "./keys.js";

let navTabPersistUserId = null;

/** @type {Map<string, object | null>} */
const pageUiMemory = new Map();

/** @param {number | null} userId */
export function setNavTabPersistUserId(userId) {
  navTabPersistUserId = userId != null ? Number(userId) : null;
}

export function getNavTabPersistUserId() {
  return navTabPersistUserId;
}

export function clearPageUiMemory() {
  pageUiMemory.clear();
}

export async function getPageUi({ userId, routeKey }) {
  const id = pageUiKey(userId, routeKey);
  if (pageUiMemory.has(id)) {
    return pageUiMemory.get(id) ?? null;
  }
  const record = (await idbGet(STORE.pageUi, id)) ?? null;
  pageUiMemory.set(id, record);
  return record;
}

export async function setPageUi({
  userId,
  routeKey,
  schemaVersion,
  scroll,
  fields,
  unitScope,
  savedAt,
}) {
  const id = pageUiKey(userId, routeKey);
  const record = {
    id,
    userId: Number(userId),
    routeKey: String(routeKey),
    ...(unitScope != null ? { unitScope: Number(unitScope) } : {}),
    schemaVersion,
    savedAt: savedAt ?? new Date().toISOString(),
    scroll,
    fields,
  };
  pageUiMemory.set(id, record);
  await idbPut(STORE.pageUi, record);
}

export async function getNavTab({ userId, persistId }) {
  const id = navTabKey(userId, persistId);
  if (pageUiMemory.has(id)) {
    const cached = pageUiMemory.get(id);
    const tab = cached?.fields?.navTab;
    return typeof tab === "string" && tab !== "" ? tab : null;
  }
  const record = await idbGet(STORE.pageUi, id);
  if (record) {
    pageUiMemory.set(id, record);
  }
  const tab = record?.fields?.navTab;
  return typeof tab === "string" && tab !== "" ? tab : null;
}

export async function setNavTab({ userId, persistId, navTab }) {
  if (navTab == null || navTab === "") {
    return;
  }
  const id = navTabKey(userId, persistId);
  const record = {
    id,
    userId: Number(userId),
    routeKey: `nav:${persistId}`,
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    fields: { navTab: String(navTab) },
  };
  pageUiMemory.set(id, record);
  await idbPut(STORE.pageUi, record);
}
