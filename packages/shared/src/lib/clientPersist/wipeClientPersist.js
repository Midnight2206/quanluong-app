import { clearOfflineDb } from "@/offline/db/openOfflineDb.js";
import { clearClientDb } from "./db.js";
import { clearDraftMemory } from "./drafts.js";
import { clearLocalDraftRegistry } from "./localDraftRegistry.js";
import { clearLocalUnsavedFieldRegistry } from "./localUnsavedFieldRegistry.js";
import { clearPageUiMemory } from "./pageUi.js";
import { clearQueryPersistCache } from "./queryPersister.js";

/** Best-effort IDB + RQ persist wipe on logout / session loss / user switch. */
export async function wipeClientPersist(userId) {
  try {
    clearDraftMemory();
    clearPageUiMemory();
    clearLocalDraftRegistry();
    clearLocalUnsavedFieldRegistry();
    await clearClientDb();
    await clearQueryPersistCache(userId);
    await clearOfflineDb(userId);
  } catch {
    /* ignore */
  }
}
