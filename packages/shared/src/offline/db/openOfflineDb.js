/** @param {string | number} userId */
export function offlineDbName(userId) {
  return `quanluong-offline-u${userId}`;
}

/** @type {Promise<import("dexie").Dexie> | null} */
let dbPromise = null;
/** @type {string | number | null} */
let openUserId = null;

/**
 * Lazy open per userId (browser-only).
 * @param {string | number} userId
 * @returns {Promise<import("dexie").Dexie>}
 */
export function openOfflineDb(userId) {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexedDB unavailable"));
  }
  if (dbPromise && openUserId === userId) {
    return dbPromise;
  }
  const previousPromise = dbPromise;
  openUserId = userId;
  dbPromise = (async () => {
    if (previousPromise) {
      try {
        (await previousPromise).close();
      } catch {
        /* ignore */
      }
    }
    const { createOfflineDb } = await import("./schema.js");
    const db = createOfflineDb(userId);
    await db.open();
    return db;
  })();
  return dbPromise;
}

/**
 * Drop per-user offline DB and reset singleton.
 * @param {string | number | null | undefined} [userId] — pass on logout when DB was never opened this session
 */
export async function clearOfflineDb(userId) {
  const targetUserId = userId ?? openUserId;
  const closingPromise = dbPromise;
  dbPromise = null;
  openUserId = null;
  if (typeof indexedDB === "undefined") return;
  if (targetUserId == null) return;
  if (closingPromise) {
    try {
      (await closingPromise).close();
    } catch {
      /* ignore */
    }
  }
  const { default: Dexie } = await import("dexie");
  await Dexie.delete(offlineDbName(targetUserId));
}
