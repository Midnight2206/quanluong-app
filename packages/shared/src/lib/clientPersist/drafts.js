import { idbDelete, idbGet, idbPut, STORE } from "./db.js";
import { draftKey, normalizeDraftScopeId } from "./keys.js";
import { LTTP_MIGRATE_SESSION_PREFIXES } from "../../pages/lttpNhapXuat/lttpNhapXuatSessionPersist.js";

/** ponytail: selfcheck swaps in-memory get/put/delete (Node has no indexedDB) */
let draftStore = {
  get: (id) => idbGet(STORE.drafts, id),
  put: (record) => idbPut(STORE.drafts, record),
  delete: (id) => idbDelete(STORE.drafts, id),
};

/**
 * Sync write-through cache so flush-on-unmount is visible to the next mount's
 * getDraft before the IndexedDB put transaction finishes.
 * @type {Map<string, object | null>}
 */
const draftMemory = new Map();

export function setDraftStoreForTest(next) {
  draftStore = { ...draftStore, ...next };
}

/** Clear RAM mirror (call with wipeClientPersist / logout). */
export function clearDraftMemory() {
  draftMemory.clear();
}

function safeJsonParse(raw) {
  if (raw == null || typeof raw !== "string") {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Resolve scopeId with unitId alias (LTTP callers). */
function resolveScope({ scopeId, unitId }) {
  return normalizeDraftScopeId(scopeId ?? unitId);
}

function isNumericScope(scope) {
  return scope != null && /^\d+$/.test(String(scope));
}

function buildRecord({ userId, draftType, scope, payload }) {
  return {
    id: draftKey(userId, draftType, scope),
    userId: Number(userId),
    draftType,
    scopeId: scope,
    ...(isNumericScope(scope) ? { unitId: Number(scope) } : {}),
    version: payload.version ?? 1,
    savedAt: new Date().toISOString(),
    ...payload,
  };
}

export async function getDraft({ userId, draftType, scopeId, unitId }) {
  const scope = resolveScope({ scopeId, unitId });
  if (scope == null) {
    return null;
  }
  const id = draftKey(userId, draftType, scope);
  if (draftMemory.has(id)) {
    return draftMemory.get(id) ?? null;
  }
  const record = (await draftStore.get(id)) ?? null;
  draftMemory.set(id, record);
  return record;
}

export async function setDraft({ userId, draftType, scopeId, unitId, payload }) {
  const scope = resolveScope({ scopeId, unitId });
  if (scope == null) {
    return;
  }
  const record = buildRecord({ userId, draftType, scope, payload });
  // Sync mirror first — remount getDraft must not race the IDB put.
  draftMemory.set(record.id, record);
  await draftStore.put(record);
}

/** Sync memory + kick IDB put (unmount flush). */
export function setDraftEager({ userId, draftType, scopeId, unitId, payload }) {
  const scope = resolveScope({ scopeId, unitId });
  if (scope == null) {
    return;
  }
  const record = buildRecord({ userId, draftType, scope, payload });
  draftMemory.set(record.id, record);
  void draftStore.put(record).catch(() => {
    /* fail-soft */
  });
}

export async function clearDraft({ userId, draftType, scopeId, unitId }) {
  const scope = resolveScope({ scopeId, unitId });
  if (scope == null) {
    return;
  }
  const id = draftKey(userId, draftType, scope);
  draftMemory.set(id, null);
  await draftStore.delete(id);
}

function listLttpSessionEntries() {
  if (typeof sessionStorage === "undefined") {
    return [];
  }
  const out = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key == null) continue;
    for (const { prefix, draftType } of LTTP_MIGRATE_SESSION_PREFIXES) {
      if (!key.startsWith(prefix)) continue;
      const unitId = Number(key.slice(prefix.length));
      if (!Number.isFinite(unitId)) continue;
      out.push({ key, draftType, unitId });
      break;
    }
  }
  return out;
}

export async function migrateLttpSessionDraftsToIdb(userId) {
  for (const { key, draftType, unitId } of listLttpSessionEntries()) {
    const existing = await getDraft({ userId, draftType, unitId });
    if (existing) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      continue;
    }
    const parsed = safeJsonParse(sessionStorage.getItem(key));
    if (parsed) {
      await setDraft({ userId, draftType, unitId, payload: parsed });
    }
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
