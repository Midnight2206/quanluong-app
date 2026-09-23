import assert from "node:assert/strict";
import {
  clearDraft,
  getDraft,
  migrateLttpSessionDraftsToIdb,
  setDraft,
  setDraftStoreForTest,
} from "./drafts.js";

const USER_ID = 42;
const UNIT_ID = 9;
const SESSION_KEY = `quanluong:lttp:issue-slip-draft:v1:${UNIT_ID}`;

const session = new Map();
globalThis.sessionStorage = {
  get length() {
    return session.size;
  },
  key(i) {
    return [...session.keys()][i] ?? null;
  },
  getItem(k) {
    return session.has(k) ? session.get(k) : null;
  },
  setItem(k, v) {
    session.set(k, String(v));
  },
  removeItem(k) {
    session.delete(k);
  },
};

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
  // 1. Empty IDB + session draft → migrate → draft in IDB, session key gone
  session.clear();
  idb.clear();
  const sessionPayload = {
    version: 1,
    unitId: UNIT_ID,
    savedAt: "2020-01-01T00:00:00.000Z",
    lines: [{ id: "a" }],
  };
  session.set(SESSION_KEY, JSON.stringify(sessionPayload));

  await migrateLttpSessionDraftsToIdb(USER_ID);

  assert.equal(session.has(SESSION_KEY), false, "session key removed after migrate");
  const migrated = await getDraft({ userId: USER_ID, draftType: "issue-slip", unitId: UNIT_ID });
  assert.ok(migrated, "draft readable after migrate");
  assert.deepEqual(migrated.lines, sessionPayload.lines);
  assert.equal(migrated.draftType, "issue-slip");
  assert.equal(migrated.userId, USER_ID);

  // 2. IDB already has draft → session ignored (not overwritten)
  session.set(
    SESSION_KEY,
    JSON.stringify({
      version: 1,
      unitId: UNIT_ID,
      savedAt: "1999-01-01T00:00:00.000Z",
      lines: [{ id: "stale-from-session" }],
    }),
  );
  const idbWinner = {
    version: 1,
    unitId: UNIT_ID,
    savedAt: "2025-06-01T00:00:00.000Z",
    lines: [{ id: "from-idb" }],
    marker: "idb-wins",
  };
  await setDraft({
    userId: USER_ID,
    draftType: "issue-slip",
    unitId: UNIT_ID,
    payload: idbWinner,
  });

  await migrateLttpSessionDraftsToIdb(USER_ID);

  assert.equal(session.has(SESSION_KEY), false, "stale session key still removed");
  const after = await getDraft({ userId: USER_ID, draftType: "issue-slip", unitId: UNIT_ID });
  assert.equal(after.marker, "idb-wins", "IDB draft not overwritten by session");
  assert.deepEqual(after.lines, [{ id: "from-idb" }]);

  await clearDraft({ userId: USER_ID, draftType: "issue-slip", unitId: UNIT_ID });
  assert.equal(idb.size, 0);

  // 3. String scopeId (non-unit) round-trip
  await setDraft({
    userId: USER_ID,
    draftType: "admin-job-titles",
    scopeId: "global",
    payload: { createName: "Trưởng" },
  });
  const scoped = await getDraft({
    userId: USER_ID,
    draftType: "admin-job-titles",
    scopeId: "global",
  });
  assert.equal(scoped.createName, "Trưởng");
  assert.equal(scoped.scopeId, "global");
  assert.equal(scoped.unitId, undefined);
  await clearDraft({ userId: USER_ID, draftType: "admin-job-titles", scopeId: "global" });
  assert.equal(idb.size, 0);

  console.log("clientPersist drafts migrate: ok");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
