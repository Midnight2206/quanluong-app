# Offline-First Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Dexie SWR HTTP cache, Serwist service worker, and a full outbox (JSON + Blob) with conflict UI — foundation first, then wire LTTP create/update.

**Architecture:** New `packages/shared/src/offline/` Dexie DB `quanluong-offline` (httpCache + outbox + meta), client-only `OfflineProvider` in private layout, Serwist in `apps/web`. Keep existing `clientPersist` for UI/drafts until later migrate; replace LTTP create outbox X1 in Task 9. No IndexedDB/SW at SSR or module top-level outside `useEffect`.

**Tech Stack:** Dexie.js, `@serwist/next`, existing `apiRequest` / React Query (parallel then gradual handoff), JSDoc (no TS in shared offline core except Serwist entry if required by package).

**Spec:** `docs/superpowers/specs/2026-09-23-offline-first-architecture-design.md`

## Global Constraints

- Order: **C then A** (generic foundation → LTTP adapter).
- Dexie hub `quanluong-offline`; keep `clientPersist` for UI/draft short-term; RQ persist allowlist shrinks as SWR covers keys.
- SW: **Serwist** (`@serwist/next`) — v1 **apps/web only**.
- Client-only: Dexie/SW init in `useEffect`; no `indexedDB` / `navigator.serviceWorker` on SSR path.
- Create/upload/import: auto-retry + immutable `idempotencyKey`.
- Update/add_item/cancel: no blind retry — refetch + `baseVersion` → `needs_review` if mismatch.
- Excel offline: store Blob only; server parses on upload.
- Image offline: Blob + object URL preview; replace with server URL after upload.
- Prefer `.selfcheck.mjs` (assert) over new test frameworks.
- Do not commit unless user asks.

## File map

| Path | Responsibility |
|------|----------------|
| `packages/shared/src/offline/db/schema.js` | Dexie class + version 1 stores |
| `packages/shared/src/offline/db/openOfflineDb.js` | `openOfflineDb(userId)`, `clearOfflineDb()` |
| `packages/shared/src/offline/cache/ttlPolicy.js` | TTL by `resourceKind` |
| `packages/shared/src/offline/cache/httpCache.js` | get/set/invalidate |
| `packages/shared/src/offline/cache/swrFetch.js` | SWR GET |
| `packages/shared/src/offline/cache/prefetch.js` | Boot whitelist |
| `packages/shared/src/offline/outbox/*` | ops, enqueue, processor, conflict, blobQuota |
| `packages/shared/src/offline/sync/*` | network + controller |
| `packages/shared/src/offline/hooks/*` | React hooks |
| `packages/shared/src/offline/ui/*` | Banner, badge, conflict dialog |
| `packages/shared/src/offline/OfflineProvider.jsx` | Init + register SW + sync |
| `apps/web` Serwist config + `sw` entry | Precache hashed assets |
| `apps/web/app/(private)/layout.jsx` | Mount OfflineProvider |
| `wipeClientPersist.js` / `authApi.js` | Also clear Dexie on logout |
| `offline/adapters/lttp/*` | Phase A wire |

---

### Task 1: Dexie schema + open/clear (P0)

**Files:**
- Create: `packages/shared/src/offline/db/schema.js`
- Create: `packages/shared/src/offline/db/openOfflineDb.js`
- Create: `packages/shared/src/offline/db/openOfflineDb.selfcheck.mjs`
- Modify: `packages/shared/package.json` — peer `dexie`
- Modify: `apps/web/package.json` — dep `dexie`

**Produces:**
- `createOfflineDb(userId) → Dexie` with stores `httpCache`, `outbox`, `meta`
- `openOfflineDb(userId) → Promise<Dexie>` (lazy, browser-only)
- `clearOfflineDb() → Promise<void>`
- DB name: `quanluong-offline-u${userId}` (per-user DB — simplest wipe)

- [ ] **Step 1:** Add deps (`npm install dexie -w @quanluong/web`; peer on shared)

- [ ] **Step 2:** Selfcheck — cacheKey helper / DB name format (no real IndexedDB required in Node for name helper):

```js
import assert from "node:assert/strict";
import { offlineDbName } from "./openOfflineDb.js";
assert.equal(offlineDbName(7), "quanluong-offline-u7");
```

- [ ] **Step 3:** Implement schema + open (guard `typeof indexedDB === "undefined"` → reject). Do **not** instantiate Dexie at module top level.

- [ ] **Step 4:** Run selfcheck — pass

---

### Task 2: OfflineProvider + private layout + logout wipe (P0)

**Files:**
- Create: `packages/shared/src/offline/OfflineProvider.jsx`
- Modify: `apps/web/app/(private)/layout.jsx` — nest inside `ClientPersistenceProvider` (or sibling under PrivateRoute)
- Modify: `packages/shared/src/lib/clientPersist/wipeClientPersist.js` — call `clearOfflineDb()`
- Create: `packages/shared/src/offline/registerServiceWorker.js` — stub `export async function registerOfflineServiceWorker() {}` until Task 5

**Produces:**
- `useOffline() → { userId, ready, db }`
- Provider: `useEffect` → `openOfflineDb(userId)` → `setReady(true)` (fail-open)

- [ ] **Step 1:** Implement provider (client-only, no Dexie import at layout server path — layout already `"use client"`)

- [ ] **Step 2:** Wire private layout

- [ ] **Step 3:** Extend wipe on logout / session loss / user switch

- [ ] **Step 4:** Manual — login private shell loads; no `indexedDB is not defined` in SSR logs

---

### Task 3: HTTP cache + SWR + TTL + prefetch (P1)

**Files:**
- Create: `ttlPolicy.js`, `httpCache.js`, `swrFetch.js`, `prefetch.js`
- Create: `cache/httpCache.selfcheck.mjs`
- Create: `hooks/useSWRResource.js`

**Produces:**
- `buildCacheKey(url, params) → string`
- `getCached(db, key)`, `setCached(db, { cacheKey, url, params, data, resourceKind, ttlMs })`
- `swrFetch({ db, url, params, resourceKind, fetcher }) → Promise<{ data, fromCache, stale }>`
- `prefetchBoot({ db, apiRequest })` — whitelist: `current-user` shape via existing fetch if available; `lttp` commodities when unitId known (or skip if no unit — document)
- `TTL`: profile 5m; lttp catalog 24h; default 10m

- [ ] **Step 1:** Selfcheck `buildCacheKey` stable param order; TTL stale when `now - lastSyncedAt > ttlMs`

- [ ] **Step 2:** Implement httpCache + swrFetch (fetcher = `() => apiRequest(...)`)

- [ ] **Step 3:** `useSWRResource` — state from cache then refresh; only under OfflineProvider

- [ ] **Step 4:** Call `prefetchBoot` from OfflineProvider when `ready && online`

- [ ] **Step 5:** Wire **one** consumer smoke: e.g. thin wrap around commodities query in LTTP **or** a small debug hook — prefer adapting one existing LTTP query hook to try SWR cache read without removing React Query yet (dual-read: RQ primary, optionally seed from Dexie). **Ponytail minimum:** export swrFetch + useSWRResource; OfflineProvider prefetch writes cache; document consumer Task 9 for full LTTP switch.

---

### Task 4: Network status + OfflineBanner (P1/P3 prep)

**Files:**
- Create: `sync/networkStatus.js`, `hooks/useNetworkStatus.js`, `ui/OfflineBanner.jsx`
- Modify: `OfflineProvider.jsx` — render banner; subscribe online/offline

**Produces:**
- `subscribeNetworkStatus(cb) → unsubscribe`
- `useNetworkStatus() → { online: boolean }`
- Banner text when `!online`

- [ ] **Step 1:** Implement + mount banner in provider
- [ ] **Step 2:** Manual DevTools offline → banner shows

---

### Task 5: Serwist on apps/web (P2)

**Files:**
- Modify: `apps/web/package.json` — `@serwist/next`, `serwist`
- Modify: `apps/web/next.config.mjs` — `withSerwist`
- Create: Serwist SW entry per current `@serwist/next` docs (e.g. `apps/web/app/sw.ts` or `src/sw.js` — **follow package README for Next 15**)
- Modify: `registerServiceWorker.js` — call Serwist window register helper if needed (often automatic)

**Produces:** Production/dev SW registering; precache `/_next/static/**`

- [ ] **Step 1:** Install + configure per Serwist Next 15 App Router guide (read latest docs while implementing)

- [ ] **Step 2:** Ensure SW registration only from client OfflineProvider / Serwist inject — no SSR crash

- [ ] **Step 3:** `next build` web succeeds; DevTools Application → SW active after load

- [ ] **Step 4:** Manual — visit app online once, go offline, hard reload shell still paints (may show cached pages)

**Note:** Docker `ui` image must rebuild after new deps (same lesson as react-query-persist).

---

### Task 6: Outbox enqueue + processor (JSON) (P3)

**Files:**
- Create: `outbox/operations.js`, `enqueue.js`, `processor.js`, `conflict.js`, `blobQuota.js` (quota stubs OK)
- Create: `outbox/outbox.selfcheck.mjs`
- Create: `sync/OfflineSyncController.js`
- Create: `hooks/useOfflineQueue.js`
- Modify: `OfflineProvider` — start controller on ready; flush on `online`

**Produces:**
- Operations constants matching spec
- `enqueueOutboxItem(db, itemPartial) → id` — generates `id` + `idempotencyKey` if missing
- `flushOutbox(db, { apiRequest, handlers })` — FIFO; create ops auto-retry with backoff; update ops call `resolveUpdateConflict`
- `compareBaseVersion(localBase, serverVersion) → 'match' | 'mismatch'`
- Status machine per spec

- [ ] **Step 1:** Selfcheck — create op allowed retry path; update mismatch → `needs_review`; idempotencyKey unchanged across retry mock

- [ ] **Step 2:** Implement processor (inject `apiRequest`; send `Idempotency-Key` header when create)

- [ ] **Step 3:** Wire controller + `useOfflineQueue`

- [ ] **Step 4:** Run selfcheck — pass

---

### Task 7: Blob upload / import + quota (P4)

**Files:**
- Extend: `enqueue.js`, `processor.js`, `blobQuota.js`
- Create: `hooks/useFileUploadQueue.js`
- Create: `ui/OutboxBadge.jsx`

**Produces:**
- Enqueue with `fileBlob`; reject if over `MAX_FILE_BYTES` or `MAX_QUEUE_BLOB_BYTES` (constants in blobQuota.js — e.g. 8MB/file, 32MB total — document in comment)
- Upload handler: `FormData` + file; on success clear blob, store URL in payload
- Import: upload only; status text “đang xử lý”; parse result from response → `synced` or `failed` with message
- `useFileUploadQueue` — `previewUrl` via `URL.createObjectURL`, revoke on synced/remove

- [ ] **Step 1:** Selfcheck quota math
- [ ] **Step 2:** Implement processor branches for `upload_image` / `import_excel`
- [ ] **Step 3:** Badge component for status labels

---

### Task 8: Conflict UI (P5)

**Files:**
- Create: `ui/ConflictReviewDialog.jsx`
- Modify: `useOfflineQueue.js` — expose `needsReview` items + actions `keepServer` / `reapply`

**Produces:**
- Dialog: local vs server summary; three actions per spec
- `keepServer`: mark item discarded/`synced` without POST
- `reapply`: refetch version, set new `baseVersion`, status `pending`

- [ ] **Step 1:** Implement dialog + wire from OfflineProvider or a small dock when `needsReview.length > 0`
- [ ] **Step 2:** Manual with mocked needs_review row in IDB (or unit selfcheck of action reducers)

---

### Task 9: LTTP adapter — replace X1 outbox (P6 / A)

**Files:**
- Create: `offline/adapters/lttp/lttpOutboxOps.js`, `useLttpIssueSlipOffline.js`
- Modify: `LttpPhieuXuatTab.jsx` — enqueue via new outbox (create + update with baseVersion from slip)
- Modify: `lttpApi.js` — remove/redirect `enqueueLttpIssueSlipCreateOffline` to new adapter
- Modify: `ClientPersistenceProvider` — stop owning flush for old outbox create **or** dual-flush until deleted
- Delete or thin: `clientPersist/outbox.js` after cutover

**Produces:**
- Create slip offline → new outbox `create_*` (map operation name `lttp.issueSlip.create` or spec `create_order` alias — **use `lttp.issue_slip.create`** in operations.js to avoid fake “order” naming)
- Update slip offline → version check path
- Upload/import only if existing LTTP API endpoints exist; else stub TODO comment and skip

- [ ] **Step 1:** Add LTTP operation constants; map to API URLs already used by `lttpApi.js`
- [ ] **Step 2:** Replace tab enqueue path
- [ ] **Step 3:** Remove old outbox flush from ClientPersistenceProvider
- [ ] **Step 4:** Manual — offline create phiếu → online appears; offline update conflict → needs_review

---

### Task 10: Spec checklist + smoke

- [ ] Tick criteria in spec §10
- [ ] Run all `packages/shared/src/offline/**/*.selfcheck.mjs`
- [ ] Rebuild Docker UI if deps changed
- [ ] Smoke matrix: SSR safe, SWR cache offline read, SW shell, outbox create flush, conflict dialog, LTTP cutover

---

## Spec coverage

| Spec | Tasks |
|------|-------|
| Dexie + client-only provider | 1–2 |
| SWR GET + prefetch | 3 |
| Network banner | 4 |
| Serwist | 5 |
| Outbox JSON + conflict policy | 6, 8 |
| Blob upload/import + quota | 7 |
| LTTP A | 9 |
| Logout wipe Dexie | 2 |

## Out of plan

- Superadmin Serwist (follow-up)
- Migrate DOM UI persist into Dexie
- Full CTQT/kitchen offline
