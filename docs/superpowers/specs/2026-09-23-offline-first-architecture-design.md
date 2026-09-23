# Offline-first architecture — Dexie cache, Serwist SW, outbox + conflict UI

Ngày: 2026-09-23  
Liên quan: `2026-09-22-client-indexeddb-persistence-design.md` (UI/nháp/RQ allowlist — **không** thay thế đầy đủ offline-first)  
Phạm vi: Nền tảng offline generic (**C**) rồi gắn LTTP (**A**)

## Vấn đề

App hiện có IndexedDB “assist” (DOM UI, draft LTTP, RQ catalog allowlist, outbox create phiếu). Chưa có:

- Stale-while-revalidate cho GET rộng  
- Service Worker / app shell khi mất mạng  
- Outbox đủ loại (kèm Blob upload/import) + conflict review  
- Banner / badge trạng thái đồng bộ  

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Thứ tự | **C rồi A** — nền generic → wire LTTP |
| Kiến trúc coexists | **Dexie hub** (`quanluong-offline`) + giữ tạm `clientPersist` (UI/draft); RQ persist **gỡ dần** khi SWR Dexie cover |
| SW | **S1 — Serwist** (`@serwist/next`), cache-first hashed assets + shell |
| Runtime | Chỉ **Client Component**; Dexie/SW init trong `useEffect`; không gọi trên SSR |
| Outbox create | Auto-retry + `idempotencyKey` |
| Outbox update/cancel/add_item | Không retry mù — refetch + so `baseVersion` → `needs_review` nếu lệch |
| Import Excel offline | Lưu Blob; **không** parse client; upload server khi online |
| Upload ảnh offline | Blob + `URL.createObjectURL` preview; thay URL thật sau upload |

## Mục tiêu

- Mất mạng (đã từng online): shell + data GET đã cache vẫn đọc được; mutation vào outbox có trạng thái rõ.  
- Có mạng lại: sync có backoff; conflict không ghi đè âm thầm.  
- LTTP phase A: create/update phiếu (+ upload/import nếu API sẵn) dùng processor mới.

## Ngoài phạm vi (v1 nền + LTTP A)

- Sync đa thiết bị / encrypt IDB  
- Offline toàn CTQT / kitchen trong cùng đợt  
- Parse Excel hoàn toàn trên client khi offline  
- Thay toàn bộ `usePrivateDomUiPersist` sang Dexie trong P0 (migrate sau)

---

## 1. App Router & client-only boundary

```
apps/web/app/layout.jsx                 # Server OK — AppProviders
apps/web/app/(private)/layout.jsx       # "use client" — OfflineProvider bên trong PrivateRoute
packages/shared/.../OfflineProvider.jsx # useEffect: open DB, register SW, start sync
```

Quy tắc:

- Không `new Dexie` / `indexedDB` / `navigator.serviceWorker` ở module top-level chạy trên server.  
- `dynamic(() => import(...), { ssr: false })` nếu cần tách bundle SW/Dexie khỏi RSC boundary.  
- Logout: `clearOfflineDb(userId)` cùng `wipeClientPersist` hiện có.

---

## 2. Cấu trúc module

```
packages/shared/src/offline/
  db/
    schema.js                 # Dexie versioned schema
    openOfflineDb.js          # open(userId), clearOfflineDb()
  cache/
    ttlPolicy.js              # TTL theo resourceKind
    httpCache.js              # getCached / setCached / invalidatePrefix
    swrFetch.js               # cache-first + background revalidate
    prefetch.js               # boot prefetch whitelist
  outbox/
    operations.js             # string constants + JSDoc OutboxItem
    enqueue.js
    processor.js              # flush, backoff, idempotency header
    conflict.js               # compare baseVersion vs server
    blobQuota.js              # max file size / queue blob bytes warn
  sync/
    networkStatus.js
    OfflineSyncController.js  # online → flush; expose status
  hooks/
    useNetworkStatus.js
    useSWRResource.js
    useOfflineQueue.js
    useFileUploadQueue.js
  ui/
    OfflineBanner.jsx
    OutboxBadge.jsx
    ConflictReviewDialog.jsx
  OfflineProvider.jsx
  registerServiceWorker.js    # thin wrapper; Serwist handles worker file in apps/web

apps/web/
  app/sw.ts (hoặc serwist entry theo docs @serwist/next)
  next.config — withSerwist
  (private)/layout.jsx — mount OfflineProvider

# Phase A
packages/shared/src/offline/adapters/lttp/
  lttpOutboxOps.js
  useLttpIssueSlipOffline.js
```

Layer: **api client** (`apiRequest`) ← **swrFetch / enqueue** ← **hooks** ← **UI**. Outbox processor không import React.

---

## 3. Dexie schema (`quanluong-offline`)

### `httpCache`

| Field | Ý nghĩa |
|-------|---------|
| `cacheKey` (PK) | Canonical `METHOD + url + stableQueryString` (GET only) |
| `url`, `paramsJson` | Debug / invalidate |
| `resourceKind` | `profile`, `lttp.commodities`, … → TTL |
| `data` | JSON body đã unwrap (cùng shape `apiRequest`) |
| `lastSyncedAt` | ISO |
| `ttlMs` | Snapshot TTL lúc ghi |

### `outbox`

| Field | Ý nghĩa |
|-------|---------|
| `id` | uuid record |
| `userId` | scope |
| `idempotencyKey` | uuid **giữ nguyên khi retry** |
| `entityId` | optional server/local id |
| `operation` | `create_order` \| `add_item` \| `update_status` \| `cancel` \| `upload_image` \| `import_excel` \| (LTTP aliases map sau) |
| `payload` | JSON |
| `fileBlob` | `Blob` \| null |
| `baseVersion` | version entity lúc enqueue (update paths) |
| `status` | `pending` \| `syncing` \| `needs_review` \| `conflict` \| `synced` \| `failed` |
| `retryCount`, `maxRetries` | network retries |
| `lastError` | message / code |
| `createdAt`, `updatedAt` | ISO |

### `meta`

KV: `schemaVersion`, `quotaWarnedAt`, v.v.

---

## 4. Cache GET — Stale-While-Revalidate

```
swrFetch({ url, params, resourceKind, fetcher })
  1. read httpCache[cacheKey] → nếu có: return { data, fromCache: true, stale: age>ttl }
  2. parallel: fetcher() via apiRequest
  3. on success: setCached; notify subscribers / setState
  4. on fail + có cache: giữ cache, surface soft error
  5. on fail + không cache: throw
```

`prefetch()` lúc `OfflineProvider` ready (online): profile/current-user + LTTP commodities/effectivePrices (whitelist config).

React Query: phase đầu **song song**; khi hook LTTP chuyển `useSWRResource`, tắt dehydrate key đó khỏi RQ persist allowlist.

---

## 5. Service Worker (Serwist)

- `@serwist/next` trong `apps/web` (và superadmin nếu cùng PWA — **v1 chỉ web**).  
- Precache build manifest (hashed `/_next/static/**`).  
- Runtime: cache-first cho static; network-first hoặc SWR cho HTML navigation shell (cấu hình Serwist mặc định phù hợp App Router).  
- Register **chỉ** trong `OfflineProvider` `useEffect` sau auth private.  
- Deploy version mới: Serwist revisioned precache — tab cũ nhận `waiting` worker; optional prompt refresh (ponytail: skip-waiting + clientsClaim trong v1 nếu team chấp nhận hard refresh).

---

## 6. Outbox processor

**Trigger:** `window` `online`, boot khi ready, manual `useOfflineQueue().flush()`.

**Thứ tự:** FIFO theo `createdAt` trong userId; một item `syncing` tại một thời điểm (tránh race).

| operation | Khi online |
|-----------|------------|
| `create_*`, `upload_image`, `import_excel` | Auto retry; header/body `Idempotency-Key: idempotencyKey`; exponential backoff cho network/5xx; 4xx validation → `failed` + UI |
| `update_*`, `add_item`, `cancel` | Refetch entity; nếu `server.version === baseVersion` (hoặc field tương đương) → apply; else → `needs_review` |

**Upload ảnh:** enqueue Blob; UI `URL.createObjectURL`; sau upload thành công: revoke object URL, xóa `fileBlob`, đánh `synced`, payload giữ URL server.

**Import Excel:** chỉ upload file; UI “đang xử lý”; kết quả parse/validate từ response server (không giả success lúc enqueue).

**Quota:** `blobQuota.js` — trần per-file + tổng blob trong outbox; vượt → toast cảnh báo, chặn enqueue mới (không xóa âm thầm).

---

## 7. Conflict UI

`ConflictReviewDialog` cho `needs_review`:

- Diff tóm tắt local `payload` vs server entity  
- Actions: **Áp dụng lại** (re-enqueue với `baseVersion` mới sau confirm), **Giữ bản server** (mark `synced`/discard), **Xem chi tiết**  
- Hết hàng / giá đổi: map từ error code server → copy rõ, không auto-resubmit  

`OfflineBanner` + `OutboxBadge` trên entity/list.

---

## 8. Phase ship

| Phase | Deliverable |
|-------|-------------|
| **P0** | Dexie open/clear + `OfflineProvider` private layout; selfcheck schema |
| **P1** | `swrFetch` + TTL + prefetch; 2–3 GET (current-user / LTTP commodities) |
| **P2** | Serwist trên `apps/web` — shell + static cache-first |
| **P3** | Outbox enqueue/processor + network banner + backoff (JSON ops) |
| **P4** | Blob upload_image + import_excel path + quota warn |
| **P5** | ConflictReviewDialog + needs_review flow |
| **P6** | LTTP adapter: thay outbox create X1; update phiếu versioned; wire upload/import nếu API có |

Mỗi phase ship độc lập; P6 không block P1–P2.

---

## 9. Kiểm tra tối thiểu

- Node selfcheck: cacheKey stable, TTL stale flag, outbox assert create vs update policy, idempotencyKey immutable on retry mock.  
- Manual: offline đọc cache; offline enqueue create; online flush; conflict needs_review; SW load shell offline sau visit.  

---

## 10. Tiêu chí xong (nền + LTTP A)

- [x] Không SSR crash (`indexedDB` / SW)  
- [x] GET whitelist SWR từ Dexie  
- [x] Serwist precache hashed assets  
- [x] Outbox đủ status + Blob ops  
- [x] Conflict UI cho update lệch version  
- [x] LTTP create/update dùng processor mới; wipe logout gồm Dexie  
