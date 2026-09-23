# Client IndexedDB Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist drafts, catalog query cache, create-only outbox, and opt-in page UI/scroll on private routes via IndexedDB so state survives browser close, keyed by user and wiped on logout.

**Architecture:** Thin IDB module (`quanluong-client`) for `pageUi` / `drafts` / `outbox`; TanStack Query persist (allowlist) for catalog; migrate LTTP sessionStorage → IDB; outbox only `lttp.issueSlip.create` (X1). Provider opens after auth; logout clears IDB + `queryClient.clear()`.

**Tech Stack:** IndexedDB (`idb-keyval` + thin multi-store wrapper), `@tanstack/react-query-persist-client`, React hooks in `@quanluong/shared`, Next private layout.

**Spec:** `docs/superpowers/specs/2026-09-22-client-indexeddb-persistence-design.md`

## Global Constraints

- Scope = all `apps/web/app/(private)/…` pages; UI fields are **opt-in per page**, not DOM scrape.
- Storage = IndexedDB; survives browser close; keyed by `userId`.
- Offline: outbox **create-only** (X1); update/delete stay online + refetch before write.
- Never persist token/password; wipe all client stores on logout / user switch.
- Reuse debounce/safe-parse patterns from `lttpNhapXuatSessionPersist.js`; no long-lived dual-write after migrate.
- Prefer selfcheck `.mjs` (assert) over new test frameworks.
- Do not commit unless user asks.

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/lib/clientPersist/db.js` | Open/version/clear `quanluong-client`; object stores |
| `packages/shared/src/lib/clientPersist/keys.js` | Key builders for pageUi / drafts / outbox |
| `packages/shared/src/lib/clientPersist/pageUi.js` | get/set pageUi records |
| `packages/shared/src/lib/clientPersist/drafts.js` | get/set/clear drafts + session migrate |
| `packages/shared/src/lib/clientPersist/outbox.js` | enqueue (create-only), list, flush helpers |
| `packages/shared/src/lib/clientPersist/broadcast.js` | BroadcastChannel last-write-wins notify |
| `packages/shared/src/lib/clientPersist/queryPersister.js` | idb-keyval persister + allowlist dehydrate |
| `packages/shared/src/lib/clientPersist/ClientPersistenceProvider.jsx` | Open DB after user; migrate; online flush |
| `packages/shared/src/hooks/usePageUiPersist.js` | Debounced fields + scroll restore |
| `packages/shared/src/hooks/useDraftPersist.js` | Async draft R/W for LTTP |
| `packages/shared/src/lib/clientPersist/*.selfcheck.mjs` | Runnable asserts |
| `packages/shared/src/app/providers/AppProviders.jsx` | PersistQueryClientProvider when authenticated |
| `packages/shared/src/features/auth/api/authApi.js` | `clearClientDb()` in logout `onSettled` |
| `packages/shared/src/pages/lttpNhapXuat/lttpNhapXuatSessionPersist.js` | Thin re-export or IDB-backed adapters |
| `packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.jsx` | Use draft persist IDB |
| `packages/shared/src/pages/lttpNhapXuat/LttpLichSuXuatTab.jsx` | Filters via IDB |
| `packages/shared/src/hooks/usePersistedNavTab.js` | Optional IDB backend (P4) |
| `packages/shared/src/layouts/MainLayout.jsx` | Optional scroll persist hook host (P4) |
| `apps/web/package.json` (+ superadmin app if separate) | Deps: `idb-keyval`, `@tanstack/react-query-persist-client` |
| `packages/shared/package.json` | peerDeps for those packages |

---

### Task 1: IDB core + keys + clear (P0)

**Files:**
- Create: `packages/shared/src/lib/clientPersist/db.js`
- Create: `packages/shared/src/lib/clientPersist/keys.js`
- Create: `packages/shared/src/lib/clientPersist/db.selfcheck.mjs`
- Modify: `packages/shared/package.json` — peer `idb-keyval`
- Modify: `apps/web/package.json` — dep `idb-keyval`

**Interfaces:**
- Produces:
  - `DB_NAME = "quanluong-client"`, `DB_VERSION = 1`
  - `STORE = { pageUi: "pageUi", drafts: "drafts", outbox: "outbox" }`
  - `openClientDb() → Promise<IDBDatabase>`
  - `clearClientDb() → Promise<void>`
  - `pageUiKey(userId, routeKey) → string`
  - `draftKey(userId, draftType, unitId) → string`

- [ ] **Step 1: Write failing selfcheck**

Create `db.selfcheck.mjs` that imports `openClientDb` / `clearClientDb` / keys and asserts key shapes (run in Node with fake IndexedDB only if available; otherwise assert pure key helpers first):

```js
import assert from "node:assert/strict";
import { pageUiKey, draftKey } from "./keys.js";

assert.equal(pageUiKey(7, "/lttp-nhap-xuat"), "7|/lttp-nhap-xuat");
assert.equal(draftKey(7, "issue-slip", 3), "7|issue-slip|3");
console.log("clientPersist keys: ok");
```

- [ ] **Step 2: Implement `keys.js`**

```js
export function pageUiKey(userId, routeKey) {
  return `${Number(userId)}|${String(routeKey)}`;
}

export function draftKey(userId, draftType, unitId) {
  return `${Number(userId)}|${String(draftType)}|${Number(unitId)}`;
}
```

- [ ] **Step 3: Implement `db.js`**

Use native IndexedDB (no Dexie). Create stores with `keyPath: "id"` where `id` is the composite key string. Export `openClientDb` (singleton promise) and `clearClientDb` (deleteDatabase + reset singleton).

```js
export const DB_NAME = "quanluong-client";
export const DB_VERSION = 1;
export const STORE = { pageUi: "pageUi", drafts: "drafts", outbox: "outbox" };

let dbPromise = null;

export function openClientDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of Object.values(STORE)) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: "id" });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  }
  return dbPromise;
}

export async function clearClientDb() {
  dbPromise = null;
  if (typeof indexedDB === "undefined") return;
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // ponytail: best-effort wipe
  });
}
```

Also export helpers `idbGet(store, id)`, `idbPut(store, record)`, `idbDelete(store, id)`, `idbGetAll(store)` wrapping transactions.

- [ ] **Step 4: Add deps**

```bash
# from repo root / apps/web
npm install idb-keyval -w @quanluong/web
```

Add `"idb-keyval": ">=6.0.0"` to `packages/shared` peerDependencies (used later for query persister; core db can stay native).

- [ ] **Step 5: Run selfcheck**

```bash
node packages/shared/src/lib/clientPersist/db.selfcheck.mjs
```

Expected: `clientPersist keys: ok`

---

### Task 2: pageUi + drafts stores + session migrate (P0/P1)

**Files:**
- Create: `packages/shared/src/lib/clientPersist/pageUi.js`
- Create: `packages/shared/src/lib/clientPersist/drafts.js`
- Create: `packages/shared/src/lib/clientPersist/drafts.selfcheck.mjs`
- Modify: `packages/shared/src/pages/lttpNhapXuat/lttpNhapXuatSessionPersist.js`

**Interfaces:**
- Consumes: `idbGet` / `idbPut` / `pageUiKey` / `draftKey`
- Produces:
  - `getPageUi({ userId, routeKey }) → Promise<record|null>`
  - `setPageUi({ userId, routeKey, schemaVersion, scroll, fields, unitScope?, savedAt? }) → Promise<void>`
  - `getDraft({ userId, draftType, unitId }) → Promise<record|null>`
  - `setDraft({ userId, draftType, unitId, payload }) → Promise<void>`
  - `clearDraft({ userId, draftType, unitId }) → Promise<void>`
  - `migrateLttpSessionDraftsToIdb(userId) → Promise<void>` — IDB first, else session → write IDB → remove session keys

- [ ] **Step 1: Selfcheck migrate order**

In `drafts.selfcheck.mjs`, mock `sessionStorage` + in-memory Map standing in for IDB helpers (or inject store), assert:

1. Empty IDB + session draft → after migrate, draft readable and session key gone.
2. IDB already has draft → session ignored (not overwritten by older session).

- [ ] **Step 2: Implement `pageUi.js` / `drafts.js`**

Record shapes per spec §2.1 / §2.2. `setDraft` wraps payload:

```js
{
  id: draftKey(userId, draftType, unitId),
  userId: Number(userId),
  draftType,
  unitId: Number(unitId),
  version: payload.version ?? 1,
  savedAt: new Date().toISOString(),
  ...payload,
}
```

`migrateLttpSessionDraftsToIdb(userId)`:
- Scan known session keys pattern `quanluong:lttp:issue-slip-draft:v1:*` and `quanluong:lttp:nhap-xuat:lich-su-filters:v1:*` (parse unitId from key).
- For each: if `getDraft` already exists for that unit, only `sessionStorage.removeItem`; else `setDraft` then remove.

- [ ] **Step 3: Keep sync session API as temporary facade (optional)**

Prefer Task 3 hooks for async. For minimal break: leave `readIssueSlipDraft` sync session readers until Task 3, or make them sync-cache filled by provider migrate. **Chosen:** provider runs migrate on login; LTTP tabs switch to async `useDraftPersist` in Task 3 — do not leave dual-write.

- [ ] **Step 4: Run selfcheck**

```bash
node packages/shared/src/lib/clientPersist/drafts.selfcheck.mjs
```

Expected: pass migrate asserts.

---

### Task 3: LTTP draft/filter UI on IDB (P1)

**Files:**
- Create: `packages/shared/src/hooks/useDraftPersist.js`
- Modify: `packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.jsx` (draft hydrate/write effects)
- Modify: `packages/shared/src/pages/lttpNhapXuat/LttpLichSuXuatTab.jsx`
- Modify: `packages/shared/src/lib/clientPersist/ClientPersistenceProvider.jsx` (create stub that migrates)

**Interfaces:**
- Consumes: `getDraft` / `setDraft` / `clearDraft`; `useCurrentUser()` for `userId`
- Produces: `useDraftPersist({ draftType, unitId, enabled }) → { draft, setDraftPayload, clear, ready }`

- [ ] **Step 1: Implement `useDraftPersist`**

- On mount when `userId` + `unitId` + `enabled`: `getDraft` → set state `draft`, `ready=true`.
- `setDraftPayload(payload)`: debounce 300ms → `setDraft(...)`.
- `clear`: `clearDraft` + local null.

- [ ] **Step 2: Wire `LttpPhieuXuatTab`**

Replace `readIssueSlipDraft` / `writeIssueSlipDraft` / `clearIssueSlipDraft` calls with the hook (`draftType: "issue-slip"`). Keep edit-mode skip (no draft apply when editing existing slip) as today.

- [ ] **Step 3: Wire history filters**

`draftType: "lich-su-filters"` or store filters via `setPageUi` with `routeKey` including unit — prefer **drafts** key `lich-su-filters` to mirror current session shape. Replace `readLichSuFilters` / `writeLichSuFilters`.

- [ ] **Step 4: Manual check**

Fill phiếu xuất nháp → close browser tab entirely → reopen → draft present. Logout → draft gone (after Task 5).

---

### Task 4: `usePageUiPersist` + scroll on LTTP (P1)

**Files:**
- Create: `packages/shared/src/hooks/usePageUiPersist.js`
- Create: `packages/shared/src/lib/clientPersist/broadcast.js`
- Modify: LTTP page shell (e.g. `LttpNhapXuatPage.jsx`) or tab that owns filters UI fields

**Interfaces:**
- Produces: `usePageUiPersist({ routeKey, schemaVersion, unitScope?, fieldKeys, getFields, setFields, scrollSelector? })`
- Default scroll: `[data-page-scroll-owner="true"]` (see `MainLayout.jsx`)

- [ ] **Step 1: Implement hook**

- Hydrate once: `getPageUi` → if `schemaVersion` match, apply `fields` via `setFields`, restore scroll in `requestAnimationFrame` double-rAF on `document.querySelector(scrollSelector)`.
- Subscribe scroll + field changes (debounce 200ms) → `setPageUi` with `savedAt`.
- On put, `broadcast.js` posts `{ type: "pageUi", id, savedAt }`; listeners with older `savedAt` may toast once (optional; can stub no-op toast in v1).

- [ ] **Step 2: Opt-in LTTP nhap-xuat**

`routeKey = "/lttp-nhap-xuat"` (or pathname), `schemaVersion = 1`, persist scroll only first if fields already in drafts.

- [ ] **Step 3: Manual check**

Scroll mid-page → leave route → return → scroll restored.

---

### Task 5: Provider + logout wipe (P0)

**Files:**
- Create: `packages/shared/src/lib/clientPersist/ClientPersistenceProvider.jsx`
- Modify: `apps/web/app/(private)/layout.jsx` — wrap children with provider inside `PrivateRoute`
- Modify: `packages/shared/src/features/auth/api/authApi.js` — `useLogoutMutation`

**Interfaces:**
- Produces: `<ClientPersistenceProvider>{children}</ClientPersistenceProvider>`
- On user ready: `openClientDb()` → `migrateLttpSessionDraftsToIdb(userId)` → set context `{ userId, ready }`
- Logout: `await clearClientDb()` then existing `qc.clear()`

- [ ] **Step 1: Provider**

```jsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { openClientDb } from "./db";
import { migrateLttpSessionDraftsToIdb } from "./drafts";

const Ctx = createContext({ userId: null, ready: false });
export function useClientPersist() {
  return useContext(Ctx);
}

export function ClientPersistenceProvider({ children }) {
  const user = useCurrentUser();
  const userId = user?.id ?? null;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (userId == null) return undefined;
    (async () => {
      try {
        await openClientDb();
        await migrateLttpSessionDraftsToIdb(userId);
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setReady(true); // ponytail: fail-open without persist
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <Ctx.Provider value={{ userId, ready }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 2: Private layout**

In `apps/web/app/(private)/layout.jsx`, inside `PrivateRoute` / `MainLayout`, wrap with `ClientPersistenceProvider`.

- [ ] **Step 3: Logout**

In `useLogoutMutation` `onSettled`:

```js
import { clearClientDb } from "@/lib/clientPersist/db";
// ...
onSettled: async () => {
  clearTargetUnitId();
  useAuthStore.getState().clearAuthState();
  try {
    await clearClientDb();
  } catch { /* ignore */ }
  qc.clear();
},
```

- [ ] **Step 4: Manual** — login, create draft, logout, login same user → draft absent.

---

### Task 6: React Query catalog persist (P2)

**Files:**
- Create: `packages/shared/src/lib/clientPersist/queryPersister.js`
- Modify: `packages/shared/src/app/providers/AppProviders.jsx`
- Modify: `apps/web/package.json` — `@tanstack/react-query-persist-client`, ensure `idb-keyval`
- Modify: `packages/shared/package.json` — peerDeps

**Interfaces:**
- Produces: `createQueryPersister(userId)`, `shouldDehydrateQuery(query)`, `PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000`
- Allowlist prefixes (exact match on `query.queryKey[0]` + `[1]`):

```js
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
```

Do **not** persist `issueSlips`, `dailyOrderSummary`, `priceTables` lists, `auth.*`.

- [ ] **Step 1: Persister**

Use `createAsyncStoragePersister` from `@tanstack/query-async-storage-persister` **or** `experimental_createQueryPersister` / `PersistQueryClientProvider` with `idb-keyval` get/set/del keyed `quanluong-rq:${userId}`.

Buster string: include `userId` so user switch invalidates cache even before wipe.

- [ ] **Step 2: Wire AppProviders**

Only enable persist when `userId` known (may need thin split: keep QueryClient in AppProviders; wrap Persist inside `ClientPersistenceProvider` or AuthBootstrap child). Prefer: `PersistQueryClientProvider` inside private provider where `userId` exists — avoids persisting guest cache.

If Persist must sit above private routes: pass `buster: String(userId ?? "anon")` and `maxAge: PERSIST_MAX_AGE_MS`; dehydrate filter as above.

- [ ] **Step 3: Manual**

Load LTTP commodities online → DevTools Application → IndexedDB has RQ cache → throttle offline → revisit → data shows from cache until stale/TTL.

---

### Task 7: Outbox create-only + flush (P3, X1)

**Files:**
- Create: `packages/shared/src/lib/clientPersist/outbox.js`
- Create: `packages/shared/src/lib/clientPersist/outbox.selfcheck.mjs`
- Modify: `ClientPersistenceProvider.jsx` — listen `online`, call `flushOutbox`
- Modify: `packages/shared/src/features/lttp/api/lttpApi.js` — create mutation path
- Modify: `LttpPhieuXuatTab.jsx` — on create failure network → enqueue

**Interfaces:**
- Produces:
  - `OUTBOX_KIND_CREATE = "lttp.issueSlip.create"`
  - `enqueueOutbox({ userId, kind, method, url, body })` — **throws/no-op if `kind !== OUTBOX_KIND_CREATE`**
  - `flushOutbox({ userId, apiRequest })` — sequential pending → post → mark done / failed
- Consumes: `apiRequest` from `@/services/apiRequest`

- [ ] **Step 1: Selfcheck X1**

```js
import assert from "node:assert/strict";
import { assertCreateOnlyKind, OUTBOX_KIND_CREATE } from "./outbox.js";

assert.doesNotThrow(() => assertCreateOnlyKind(OUTBOX_KIND_CREATE));
assert.throws(() => assertCreateOnlyKind("lttp.issueSlip.update"));
```

- [ ] **Step 2: Implement outbox**

Status machine: `pending` → `sending` → `done` | `failed`. Max retries 5; 4xx → `failed` no retry; network/5xx → backoff.

- [ ] **Step 3: Wire create**

In create mutation `onError` or tab submit catch: if offline / network error and body is create payload, `enqueueOutbox` + toast “Đã lưu hàng đợi, sẽ gửi khi có mạng”.

Do **not** enqueue from `useUpdateLttpIssueSlipMutation`.

- [ ] **Step 4: Flush on online**

Provider: `window.addEventListener("online", flush)`. After successful create flush, `invalidateLttpData(qc)` and clear matching local draft if desired.

- [ ] **Step 5: Manual** — DevTools offline → submit new slip → online → slip appears on server.

---

### Task 8: Private-wide nav tab + scroll opt-in (P4)

**Files:**
- Modify: `packages/shared/src/hooks/usePersistedNavTab.js` — write/read via IDB `pageUi` field `navTab` when `userId` available; migrate session key once
- Modify: `packages/shared/src/layouts/MainLayout.jsx` — call `usePageUiPersist` for scroll-only with `routeKey` from `usePathname()`

**Interfaces:**
- Nav tab: still sync API for TabPanel; hydrate from IDB asynchronously then correct tab if mismatch (one paint flash acceptable) **or** keep session write + async mirror to IDB for survival across browser close.

**Chosen mirror:** on read, try session first for instant paint; background: if IDB has value and session empty, write session; on write, write both session + IDB. On logout, clearClientDb already; also clear `quanluong:navTab:*` session keys in logout (best-effort loop not required — session dies with tab; IDB wipe is the cross-session guarantee).

- [ ] **Step 1: Dual-write nav tab to IDB** under `pageUi` key `nav:${persistId}` or field on route — simpler: drafts-like store entry `draftType: "navTab"` key `${userId}|navTab|${persistId}` via small `setNavTab` / `getNavTab` in `pageUi.js`.

- [ ] **Step 2: MainLayout scroll persist** — `routeKey = pathname`, `schemaVersion = 1`, empty fields, scroll only.

- [ ] **Step 3: Manual** — switch tabs on dashboard/LTTP, close browser, reopen → tab + scroll restored.

---

### Task 9: Spec checklist + smoke

- [ ] **Step 1:** Tick criteria in spec §8 against implemented behavior.
- [ ] **Step 2:** Run all selfchecks:

```bash
node packages/shared/src/lib/clientPersist/db.selfcheck.mjs
node packages/shared/src/lib/clientPersist/drafts.selfcheck.mjs
node packages/shared/src/lib/clientPersist/outbox.selfcheck.mjs
```

- [ ] **Step 3:** Smoke matrix:

| Case | Expect |
|------|--------|
| Draft survives browser close | yes |
| Logout clears draft | yes |
| Catalog cache offline (TTL) | yes |
| Offline create → online flush | yes |
| Offline update | blocked / no enqueue |
| Second user on same browser | no leak |

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| IDB `quanluong-client` + stores | 1 |
| pageUi / drafts / migrate session | 2–3 |
| Query persist allowlist + TTL + user buster | 6 |
| Outbox create-only X1 + flush | 7 |
| Provider + logout wipe | 5 |
| Opt-in UI + scroll LTTP then private-wide | 4, 8 |
| Multi-tab BroadcastChannel | 4 (`broadcast.js`) |
| No token in IDB | 5–6 (allowlist + clear) |
| Selfchecks | 1, 2, 7, 9 |

## Out of plan (per spec)

- PWA / service worker
- Encrypt IDB
- Multi-device sync
- Outbox for non-create mutations
- Full Chung từ form field persist in v1
