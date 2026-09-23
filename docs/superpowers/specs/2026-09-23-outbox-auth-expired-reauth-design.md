# Outbox AUTH_EXPIRED + reauth overlay

Ngày: 2026-09-23  
Liên quan: `2026-09-23-reconnect-gate-and-field-marks-design.md`, `2026-09-23-offline-first-architecture-design.md`  
Approach: **1** — classify trong processor + event/state trong `OfflineProvider`

## Vấn đề

1. `flushOutbox` gom mọi 4xx qua `isClientError` → item `failed`. 401 (hết phiên) và 403 (thiếu quyền) bị xử lý giống nhau.
2. Khi access/refresh hết hạn giữa queue FIFO, các item sau vẫn bị gọi API → spam 401 và có thể mark `failed` oan.
3. Không có UX reauth tại chỗ: user phải tự vào `/login`, mất ngữ cảnh reconnect gate.
4. 401 ≠ 403 về UX: đăng nhập lại giải được 401; 403 cần admin / đổi quyền.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Approach | **1** — classify in processor + Provider trigger |
| Reauth UX | **A** — modal overlay tại chỗ |
| `verifySessionOrRefresh` | **C** — proactive trước flush + reactive bail trong loop |
| 403 | **A** — mark item `failed`, tiếp tục flush |
| Sau login thành công | **A** — auto resume flush / `runReconnectSync` |
| Status Dexie mới | **Không** — 401 giữ item `pending` |

## Ngoài phạm vi

- Đổi BE cookie / refresh policy.
- Mid-session React Query 401 ngoài outbox (giữ `httpClient` interceptor hiện tại).
- Google OAuth trong `ReauthOverlay` (redirect phá modal); link phụ tới `/login` nếu cần.
- Status outbox mới (`auth_blocked`, …).

---

## 1. Phân loại lỗi trong `flushOutbox`

**Helpers** (export, testable):

| Helper | Điều kiện |
|--------|-----------|
| `isAuthExpired(err)` | `err?.status === 401` |
| `isForbidden(err)` | `err?.status === 403` |
| `isClientError(err)` | `400 ≤ status < 500` **và không** 401/403 |

**Hành vi trong loop:**

1. **401 (mọi operation):** reset item đang xử lý → `status: "pending"` (không tăng `retryCount`), set `lastError` ngắn (vd. `"AUTH_EXPIRED"` hoặc message từ BE), **`break`** — không đụng item còn lại trong queue snapshot.
2. **403:** mark item `failed`, `lastError` = message quyền từ BE hoặc fallback *"Bạn không có quyền thực hiện thao tác này"*, `failed++`, **continue**.
3. **4xx khác:** giữ hành vi hiện tại (create-like → `failed` ngay; versioned update → `failed`).
4. **Network / 5xx / không status:** giữ hành vi hiện tại (create-like retry + backoff; update → `failed`).

**Return shape:**

```js
{ flushed: number, failed: number, needsReview: number, authExpired: boolean, forbidden: number }
```

- `authExpired: true` khi bail do 401 trong loop, hoặc khi proactive verify fail trước khi đụng item.
- `forbidden` = số item vừa mark `failed` vì 403 trong lần flush này (dùng cho toast một lần).
- Caller cũ chỉ đọc `flushed` / `failed` vẫn an toàn; phải cập nhật default `empty` trong controller / provider: `authExpired: false`, `forbidden: 0`.

---

## 2. `verifySessionOrRefresh`

**File gợi ý:** `packages/shared/src/offline/auth/verifySessionOrRefresh.js`

```js
async function verifySessionOrRefresh({ apiRequest }) →
  { ok: true, user } | { ok: false, reason: 'AUTH_EXPIRED' }
```

**Thứ tự:**

1. `GET /auth/current-user` qua `apiRequest` (interceptor đã thử refresh một lần nếu access hết hạn).
2. Nếu 401: `POST /auth/refresh-token` rồi `GET /auth/current-user` lại.
3. Vẫn fail hoặc không có user → `{ ok: false, reason: 'AUTH_EXPIRED' }`.
4. Thành công → cập nhật auth store cùng path với `fetchCurrentUser` (`setAuthState` + `mapPermissionsFromUser`) → `{ ok: true, user }`.

**ponytail:** không invent refresh queue song song với `httpClient`; bước 2 chỉ khi current-user vẫn 401 (race / path bị skip interceptor).

**Chỗ gọi:**

| Điểm | Hành vi |
|------|---------|
| `OfflineSyncController.flush` — **trước** `flushOutboxImpl` | Verify fail → return `{ flushed:0, failed:0, needsReview:0, authExpired:true, forbidden:0 }` — **không** đổi status item. `flushOutbox` không gọi verify (giữ reactive 401 trong loop). |
| Trong loop khi `isAuthExpired` | §1 |
| Sau login thành công trong modal | Gọi lại verify rồi resume sync |

---

## 3. Reauth trigger + overlay + reconnect / 403 UX

### 3.1 Trigger

Khi `flush()` (auto / reconnect / manual) trả `authExpired: true`:

1. `OfflineProvider` set `reauthRequired = true` (state riêng).
2. Hiện `ReauthOverlay` (z-index ≥ reconnect overlay; chặn pointer).
3. **Không** wipe outbox / drafts / local-unsaved marks.
4. `runReconnectSync`: nếu `flushResult.authExpired` → **không** throw `OUTBOX_PARTIAL_FLUSH_MSG`; giữ `reconnectBlocking` đến khi reauth xong rồi resume pipeline (flush → invalidate → refetch → prefetchBoot).

### 3.2 `ReauthOverlay` (v1)

- Copy: *"Phiên hết hạn, đăng nhập lại"*
- Form identifier + password: reuse `loginSchema` + `useLoginMutation`
- Không Google trong modal; optional link tới `/login` cho Google
- Login success:
  - User id đổi → wipe client persist (đã có trong `useLoginMutation`)
  - Cùng user → giữ drafts / outbox
- Rồi: `verifySessionOrRefresh` → clear `reauthRequired` → resume `runReconnectSync` (nếu đang gate) hoặc `controller.flush()` (nếu không)

### 3.3 403 UX

- Item `failed` + message quyền (OutboxBadge như failed hiện tại).
- Sau flush trong `OfflineProvider` (và manual flush qua cùng wrapper): nếu `result.forbidden > 0` → toast **một lần** *"Bạn không có quyền thực hiện thao tác này"* (không spam từng item).
- Reconnect: `failed > 0` (gồm 403) vẫn fail gate như hiện tại → overlay lỗi + **Thử lại**; **không** mở reauth.

---

## 4. Data flow (tóm tắt)

```
online / reconnect / manual flush
  → verifySessionOrRefresh
      fail → { authExpired: true } → ReauthOverlay → login → verify → resume
      ok   → flushOutbox loop
              401 → pending + break + authExpired
              403 → failed + continue
              other 4xx / 5xx → như cũ
  → runReconnectSync
      authExpired → chờ reauth (không partial-flush error)
      failed > 0 (không auth) → partial flush error + Thử lại
      ok → invalidate / refetch / prefetchBoot → bỏ gate
```

---

## 5. Self-check / kiểm thử

- `isAuthExpired` / `isForbidden` / `isClientError` unit asserts.
- `flushOutbox` mock: item1 → 401 → item1 `pending`, item2 không được gọi, `authExpired: true`.
- `flushOutbox` mock: item1 → 403 → item1 `failed`, item2 vẫn chạy, `forbidden: 1`.
- `verifySessionOrRefresh`: current-user ok; 401 rồi refresh ok; refresh fail → `AUTH_EXPIRED`.
- `runReconnectSync`: `authExpired` không throw partial message; `failed > 0` vẫn throw.

---

## 6. Files chạm (dự kiến)

| File | Thay đổi |
|------|----------|
| `offline/outbox/processor.js` | Classify 401/403; bail; return `authExpired` |
| `offline/auth/verifySessionOrRefresh.js` | Helper mới |
| `offline/sync/OfflineSyncController.js` | Proactive verify; forward `authExpired` |
| `offline/runReconnectSync.js` | Nhánh `authExpired` |
| `offline/OfflineProvider.jsx` | `reauthRequired` + resume sau login |
| `offline/ui/ReauthOverlay.jsx` | Modal login |
| Selfchecks + cập nhật empty defaults callers |
