import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { del, get, set } from "idb-keyval";

export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const ALLOW = new Set([
  "foodGroups",
  "foodGroupsCatalog",
  "commodities",
  "suppliers",
  "effectivePrices",
  "issueFormDefaults",
  "issueSlipSignatureSettings",
  "recipientUsers",
  "buyerUsers",
  "receivingDefaultRecipient",
  "receivingDefaultRecipientsList",
  "buyerDefaultsList",
]);

export function shouldDehydrateQuery(query) {
  const key = query.queryKey;
  if (!Array.isArray(key) || key[0] !== "lttp") return false;
  return ALLOW.has(key[1]);
}

export function rqPersistStorageKey(userId) {
  return `quanluong-rq:${userId}`;
}

export function createQueryPersister(userId) {
  const key = rqPersistStorageKey(userId);
  return createAsyncStoragePersister({
    key,
    storage: {
      getItem: () => get(key),
      setItem: (_k, value) => set(key, value),
      removeItem: () => del(key),
    },
  });
}

export async function clearQueryPersistCache(userId) {
  if (userId == null) return;
  await del(rqPersistStorageKey(userId));
}
