/**
 * Remount race selfcheck: eager/memory write + IDB survive remount.
 */
import assert from "node:assert/strict";
import {
  clearDraft,
  clearDraftMemory,
  getDraft,
  setDraft,
  setDraftEager,
  setDraftStoreForTest,
} from "../lib/clientPersist/drafts.js";

const idb = new Map();
setDraftStoreForTest({
  get: async (id) => idb.get(id) ?? undefined,
  put: async (record) => {
    idb.set(record.id, record);
  },
  delete: async (id) => {
    idb.delete(id);
  },
});

async function run() {
  idb.clear();
  clearDraftMemory();

  setDraftEager({
    userId: 1,
    draftType: "ordering-filters",
    unitId: 9,
    payload: { orderDate: "2026-03-01", supplierFilterKey: "none" },
  });
  const after = await getDraft({ userId: 1, draftType: "ordering-filters", unitId: 9 });
  assert.equal(after.orderDate, "2026-03-01");

  await setDraft({
    userId: 1,
    draftType: "ordering-filters",
    unitId: 9,
    payload: { orderDate: "2026-04-02", supplierFilterKey: "all" },
  });
  clearDraftMemory();
  const again = await getDraft({ userId: 1, draftType: "ordering-filters", unitId: 9 });
  assert.equal(again.orderDate, "2026-04-02", "IDB survives memory clear");

  await clearDraft({ userId: 1, draftType: "ordering-filters", unitId: 9 });
  console.log("useDraftPersist behavior: ok");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
