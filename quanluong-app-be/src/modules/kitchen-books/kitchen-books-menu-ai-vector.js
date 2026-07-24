/**
 * Qdrant vector index for kitchen menu days (1 point / day).
 * Scaffold only: no-op when QDRANT_URL empty; real embed/search comes later.
 */

function isQdrantEnabled() {
  return Boolean(String(process.env.QDRANT_URL || "").trim());
}

function getQdrantConfig() {
  return {
    url: String(process.env.QDRANT_URL || "").trim().replace(/\/+$/, ""),
    collection: String(process.env.QDRANT_COLLECTION || "kitchen_menu_days").trim() || "kitchen_menu_days",
    apiKey: String(process.env.QDRANT_API_KEY || "").trim() || null,
  };
}

/**
 * Upsert one menu day into Qdrant. Safe to call fire-and-forget.
 * @param {{ menuDayId: number, unitId: number, menuDate: string, text: string }} _payload
 */
async function upsertMenuDayVector(_payload) {
  if (!isQdrantEnabled()) {
    return { ok: true, skipped: true, reason: "qdrant_disabled" };
  }
  // ponytail: real HTTP upsert + embedding in follow-up; keep save path unblocked.
  return { ok: true, skipped: true, reason: "scaffold_pending_embed" };
}

/**
 * @param {{ queryText: string, limit?: number, preferWeekday?: number }} _query
 * @returns {Promise<{ points: { menuDayId: number, score: number }[], skipped?: boolean }>}
 */
async function searchSimilarMenuDays(_query) {
  if (!isQdrantEnabled()) {
    return { points: [], skipped: true, reason: "qdrant_disabled" };
  }
  return { points: [], skipped: true, reason: "scaffold_pending_embed" };
}

/** Non-blocking; never throws to callers of menu save. */
function scheduleMenuDayVectorUpsert(payload) {
  setImmediate(() => {
    upsertMenuDayVector(payload).catch(() => {
      /* swallow — index must not break menu save */
    });
  });
}

export {
  isQdrantEnabled,
  getQdrantConfig,
  upsertMenuDayVector,
  searchSimilarMenuDays,
  scheduleMenuDayVectorUpsert,
};
