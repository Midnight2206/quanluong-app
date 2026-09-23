# Reconnect gate + persistent local-unsaved field marks

Ngày: 2026-09-23  
Liên quan: `2026-09-23-offline-first-architecture-design.md`, `2026-09-22-client-indexeddb-persistence-design.md`  
Phạm vi: **Approach A** — gate trong `OfflineProvider` + giữ nháp local + cảnh báo field bền qua remount

## Vấn đề

1. `online` hiện chỉ dựa `navigator.onLine`. Khi “có mạng” ảo (captive portal / API chết) app vẫn coi là online.
2. Offline→online: flush outbox + `prefetchBoot` chạy **nền**, **không chặn UI**. User tiếp tục sửa trên React Query / state RAM có thể lệch server.
3. Auto-flush không đi qua wrapper `invalidateLttpData` → sau sync, cache RQ dễ vẫn stale (`staleTime` 120s).
4. Cảnh báo field “chỉ là dữ liệu tạm trên máy” biến mất khi đổi trang / remount tab → user hiểu nhầm dữ liệu đã “sạch”.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Approach | **A** — orchestrate trong `OfflineProvider` |
| Nháp local (IDB draft) | **Giữ** khi reconnect |
| Cảnh báo field | **Giữ**; bền qua đổi trang / remount |
| UX gate | Overlay loading chặn pointer-events đến khi sync xong |
| Online thật | Probe API sau sự kiện `online` (không chỉ `navigator.onLine`) |

## Ngoài phạm vi

- Xóa / merge nháp local với server (giữ nguyên; conflict outbox vẫn qua Conflict dock).
- Đổi chính sách outbox / Serwist.
- Wire cảnh báo vào mọi control custom không phải `input`/`select`/`textarea` (Radix combobox) — v1 giữ native controls.
- Login / password / modal / chat (`data-no-persist`).

---

## 1. Reachability: probe online

Mở rộng `networkStatus` (hoặc helper cạnh nó):

- Giữ listener `window` `online` / `offline` làm **hint**.
- Khi nhận `online` (hoặc bootstrap nếu `navigator.onLine`): gọi probe nhẹ authenticated, ưu tiên `GET /auth/current-user` qua `apiRequest` (đã có cookie/JWT).
- Chỉ emit `online: true` (app-level) khi probe **OK**.
- Probe fail: giữ / emit `online: false` (hoặc `degraded`), schedule retry ngắn (vd. 2s → 5s → 10s, max ~30s) khi `navigator.onLine` vẫn true.
- Khi `offline` event: emit `false` ngay, hủy probe/retry.

App-level `useNetworkStatus` / `OfflineProvider.online` dùng tín hiệu **đã probe**, không raw `navigator.onLine`.

**Self-check:** unit/selfcheck giả lập: `navigator.onLine=true` + probe reject → vẫn offline; probe resolve → online.

---

## 2. Reconnect gate (blocking)

### 2.1 Trigger

Chạy gate khi:

- App-level `online` chuyển `false → true`, và
- `userId` + offline DB `ready` (fail-open nếu không có DB: vẫn invalidate/refetch RQ + probe).

Không chặn lần mount đầu nếu đã online ổn định (tránh flash loading mỗi F5). Chỉ gate trên **transition** offline→online trong session (và tùy chọn: lần đầu sau khi từng thấy offline).

### 2.2 Pipeline ( tuần tự, `await` )

```
set reconnectBlocking = true
→ await flushOutbox (controller; luôn invalidate LTTP sau flush, kể cả flushed=0 nếu vừa offline)
→ qc.invalidateQueries cho root domain đang dùng offline (ít nhất qk.lttp.root; mở rộng nếu đã có key offline khác)
→ await qc.refetchQueries({ type: "active" })
→ await prefetchBoot({ db, apiRequest })   // Dexie SWR whitelist
→ set reconnectBlocking = false
```

Lỗi / timeout (vd. 45s):

- Overlay hiện lỗi + nút **Thử lại** (không âm thầm mở UI như đã sync xong).
- `reconnectBlocking` giữ `true` đến khi retry thành công hoặc user… (v1: chỉ retry; không “bỏ qua”).

### 2.3 Context API

Mở rộng `useOffline()`:

```ts
{
  online: boolean;           // probed
  reconnectBlocking: boolean;
  reconnectError: string | null;
  retryReconnect: () => void;
  // ...existing
}
```

### 2.4 UI overlay

Component mới cạnh banner, mount trong `OfflineProvider`:

- Full-viewport (trong private shell), `pointer-events: auto`, z-index trên nội dung form.
- Copy: **“Đang đồng bộ dữ liệu từ máy chủ (bạn vừa làm việc offline)…”**
- Spinner / progress indeterminate.
- Print: `print:hidden`.
- Không thay OfflineBanner khi đang offline; khi blocking, banner offline đã tắt vì `online===true`.

Forms không cần tự `disabled` nếu overlay chặn click; optional: `pointer-events-none` trên children khi blocking (đề phòng focus/keyboard) — khuyến nghị bọc children:

```
{reconnectBlocking ? <ReconnectSyncOverlay ... /> : null}
<div aria-busy={reconnectBlocking} className={blocking ? "pointer-events-none select-none" : undefined}>
  {children}
</div>
```

---

## 3. Flush + invalidate đúng đường

Hiện auto-flush (`controller.flush` / effect online) **bypass** wrapper có `invalidateLttpData`.

Sửa:

- Mọi đường reconnect gate gọi **một** `runReconnectSync()` dùng chung với logic invalidate.
- `OfflineSyncController.flush`: nếu đang flush, caller sau **await cùng promise** (không return early `{flushed:0}`).
- Sau flush trong gate: **luôn** `invalidateLttpData(qc)` (và refetch active), không chỉ khi `flushed > 0` — vì server có thể đổi từ thiết bị khác trong lúc offline.

---

## 4. Nháp local + cảnh báo field bền

### 4.1 Policy

- Reconnect **không** xóa IDB drafts / pageUi.
- Field marks **không** clear khi đổi `pathname`.
- Clear marks chỉ khi: `clearLocalUnsavedFieldMarks` (sau save server / `useDraftPersist.clear`), hoặc logout wipe.

### 4.2 Vì sao mark mất hôm nay

`useLocalUnsavedFieldMarks` `useEffect([pathname])` gọi `clearAllMarks` + chỉ gắn lại sau blur đã edit → remount = mất cảnh báo.

### 4.3 Sửa

1. **Registry nhẹ** (module singleton, song song `localDraftRegistry`): map `routeKey + fieldKey → { marked: true }` (hoặc Set id). Upsert khi `ensureMark`; delete khi `removeMark` / clear-all event.
2. **Không** `clearAllMarks` vì đổi route. On pathname change: sau paint (rAF / short timeout), `reapplyMarksForRoute(pathname)` — query markable controls trong page scroll root, nếu registry nói marked **và** `fieldHasValue` → `ensureMark`.
3. Sau hydrate draft (`useDraftPersist` set state): dispatch `quanluong:reapply-local-unsaved-marks` (hoặc gọi reapply) vì DOM/value có thể xuất hiện muộn hơn route change.
4. Tip giữ nguyên: *“Dữ liệu chưa được lưu vào máy chủ. Đây chỉ là dữ liệu tạm trên máy.”*

**Ceiling (ponytail):** registry theo fieldKey (`persistKey|name|id`); control không có key dùng weak path (chỉ sống trong DOM session). Upgrade sau: gắn `data-persist-key` rộng hơn.

---

## 5. Files chạm (dự kiến)

| File | Việc |
|------|------|
| `offline/sync/networkStatus.js` (+ probe helper) | Probed online + retry |
| `offline/hooks/useNetworkStatus.js` | Expose probed status |
| `offline/OfflineProvider.jsx` | Gate pipeline + context |
| `offline/ui/ReconnectSyncOverlay.jsx` | Loading / error / retry |
| `offline/sync/OfflineSyncController.js` | Share in-flight flush promise |
| `offline/cache/prefetch.js` | Giữ; await trong gate |
| `hooks/useLocalUnsavedFieldMarks.js` | Registry + reapply; bỏ clear-on-route |
| `hooks/useDraftPersist.js` | Sau hydrate / clear: reapply hoặc clear marks (clear đã có) |
| `index.css` | Style overlay nếu cần |
| `*.selfcheck.mjs` | Probe + registry reapply smoke |

---

## 6. Acceptance

1. Tắt mạng → banner offline; sửa form → blur thấy warning field; đổi trang rồi quay lại → **vẫn thấy** warning trên field đã sửa (khi draft hydrate xong).
2. Bật mạng lại → overlay “Đang đồng bộ…” chặn thao tác → hết overlay mới click/sửa được.
3. Trong lúc API chết nhưng Wi‑Fi còn: app **không** mở online / không kết thúc gate thành công.
4. Sau gate: list/data LTTP (query active) khớp server (không kẹt stale 120s chỉ vì vừa offline).
5. Nháp local còn sau reconnect; xóa nháp / save server → marks biến mất.
6. Login / password / `data-no-persist` không bị mark.

## 7. Non-goals / rủi ro

- Overlay không thay conflict review cho outbox `needs_review`.
- Probe phụ thuộc auth; nếu 401 → coi offline/degraded + (hành vi auth hiện có) redirect login — không infinite gate.
- `refetchQueries({ type: "active" })` chỉ trang đang mở; trang khác refetch khi vào lại (OK với staleTime sau invalidate).
