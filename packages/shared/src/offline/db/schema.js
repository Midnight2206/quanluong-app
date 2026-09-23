/**
 * Dexie schema for per-user offline DB. Loaded only via dynamic import from openOfflineDb (browser).
 */
import Dexie from "dexie";

/** @type {1} */
export const OFFLINE_DB_VERSION = 1;

/** Dexie store definitions — indexes match offline-first spec (httpCache / outbox / meta). */
export const OFFLINE_STORE_SCHEMA = {
  httpCache: "cacheKey, resourceKind",
  outbox: "id, userId, status, createdAt",
  meta: "key",
};

/**
 * @param {string | number} userId
 * @returns {import("dexie").Dexie}
 */
export function createOfflineDb(userId) {
  const db = new Dexie(`quanluong-offline-u${userId}`);
  db.version(OFFLINE_DB_VERSION).stores(OFFLINE_STORE_SCHEMA);
  return db;
}
