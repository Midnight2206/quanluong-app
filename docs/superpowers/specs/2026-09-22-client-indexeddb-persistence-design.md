# Client IndexedDB persistence — nháp, cache danh mục, outbox, UI/scroll

Ngày: 2026-09-22  
Liên quan: `lttpNhapXuatSessionPersist.js`, `kitchenBooksSessionPersist.js`, `TabPanel` (`quanluong:navTab:*`), `AppProviders` (React Query)  
Phạm vi: Mọi trang trong `apps/web/app/(private)/…` — persist trên máy user qua **IndexedDB**, sống sau khi đóng trình duyệt

## Vấn đề

1. Nháp LTTP (phiếu xuất / đặt hàng) và vài UI state đang nằm `sessionStorage` — mất khi đóng tab/browser.  
2. Danh mục (mặt hàng, giá, người nhận…) refetch mỗi lần vào lại; offline/mạng chậm không có cache dài hạn.  
3. Không có hàng đợi mutation khi mất mạng.  
4. Muốn giữ input/select/textarea + **scroll từng trang** trên toàn private shell.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Phạm vi route | Toàn bộ **private** (`(private)` layout) |
| Storage | **IndexedDB** (không chỉ sessionStorage); sống qua đóng trình duyệt |
| Kiến trúc | **B**: TanStack Query persist cho cache danh mục + IDB riêng cho draft / pageUi / outbox |
| UI fields | **Opt-in theo trang** (khai báo field keys + scroll root) — không auto-serialize DOM toàn app |
| Offline conflict | **X1**: Outbox chỉ **retry create**; **update** cần mạng + refetch trước khi ghi |
| Auth | Persist **theo `userId`**; **xóa toàn bộ DB client khi logout** |
| Bảo mật | Không persist token, password, ciphertext nhạy cảm |

## Mục tiêu

- User đóng browser rồi mở lại: nháp LTTP, filter/tab đã opt-in, scroll trang, và catalog cache còn dùng được (trong TTL).  
- Offline: tạo phiếu mới có thể vào outbox; khi online flush create thành công.  
- Update phiếu không ghi đè mù khi conflict.  
- Multi-tab cùng user: last-write-wins theo `savedAt` + thông báo nhẹ nếu cần.

## Ngoài phạm vi (v1)

- Sync đa thiết bị / cloud backup nháp.  
- Conflict merge phức tạp ( operational transform ).  
- Encrypt IndexedDB at rest.  
- Persist toàn bộ form Chung từ / quyết toán / mọi field mọi trang trong một đợt.  
- Outbox cho mọi mutation app (chỉ create issue slip LTTP trong v1).  
- Service Worker / PWA full offline shell (có thể phase sau).

---

## 1. Hướng đã chọn (tóm tắt trade-off)

| Hướng | Ý | Kết luận |
|--------|----|----------|
| A. IDB thủ công từng feature | Ít dep, kiểm soát cao | Cache API (#2) phải tự viết TTL/invalidate |
| **B. IDB + Query persist** | Persist query cho catalog; IDB cho UI/draft/outbox | **Chọn** — khớp stack `@tanstack/react-query` hiện có |
| C. Snapshot DOM/form toàn trang | Ít khai báo | Dễ vỡ với RHF/complex UI; khó version |

---

## 2. Database & stores

**Tên DB:** `quanluong-client`  
**Version schema:** số nguyên tăng khi đổi shape store (migrate hoặc wipe store lệch version).

### 2.1 `pageUi`

Key: `${userId}|${routeKey}` (+ optional `unitScope` trong value nếu trang phụ thuộc kho).

```
{
  userId,
  routeKey,          // pathname + query ổn định (bỏ param tạm / ephemeral)
  unitScope?,        // unitId khi state theo kho
  schemaVersion,     // per-page UI schema
  savedAt,           // ISO
  tabId?,            // optional: focus tab trong multi-tab sync
  scroll: { rootSelector?, top, left },
  fields: Record<string, string | number | boolean | null>
}
```

- Trang **đăng ký** field keys + scroll container (vd. root của `UnifiedPageScroll` / layout scroll).  
- Không quét mọi `<input>` mặc định.

### 2.2 `drafts`

Key: `${userId}|${draftType}|${unitId}` (vd. `issue-slip`, `ordering`).

- Migrate từ `sessionStorage` keys trong `lttpNhapXuatSessionPersist.js` (`issue-slip-draft:v1`, filters, …): **đọc IDB trước → fallback session → ghi IDB → xóa key session** (không dual-write lâu dài).  
- Giữ `version` payload + `savedAt` + `unitId` như draft hiện tại.

### 2.3 `queryCache` (via persist client)

- Dùng `@tanstack/react-query-persist-client` + persister IndexedDB (`idb-keyval` hoặc thin wrapper).  
- Có thể nằm **DB/key riêng** của persister (không bắt buộc cùng object store với `pageUi`); logout vẫn phải xóa cùng lúc với stores kia.  
- **Allowlist** query keys danh mục (commodities, prices, recipient users, signature settings read, …) — không persist query chứa PII rộng / báo cáo lớn / auth session.  
- **TTL** mặc định 24h; **bust** khi đổi `unitId` scope hoặc sau mutate thành công liên quan.  
- Gắn `userId` vào dehydrate key / buster để không đọc cache user khác trên cùng máy.

### 2.4 `outbox`

```
{
  id,                // uuid
  userId,
  kind,              // v1: 'lttp.issueSlip.create' only
  method, url, body,
  createdAt,
  retries,
  status,            // pending | sending | failed | done
  lastError?
}
```

- Flush khi `navigator.onLine` + window `online` event, tuần tự.  
- **X1:** chỉ enqueue **create**; update/delete vẫn yêu cầu online; trước update luôn refetch slip.  
- Lỗi 4xx validation: dừng retry, toast, giữ bản nháp local để user sửa.  
- 5xx / network: backoff, tăng `retries`, trần số lần rồi `failed`.

---

## 3. Provider & lifecycle

1. `ClientPersistenceProvider` bọc trong private shell (sau auth biết `userId`) — hoặc hydrate lazy khi `PrivateRoute` resolve user.  
2. Open IDB → migrate sessionStorage drafts nếu còn → gắn Query persist.  
3. **Logout / đổi user:** `clear` toàn bộ stores + `queryClient.clear()` + bỏ persist dehydrate cũ.  
4. Restore scroll: `useLayoutEffect` / rAF sau layout ổn định (tránh nhảy trước khi bảng load).

### Multi-tab

- `BroadcastChannel('quanluong-client')` (fallback: không sync realtime nếu thiếu).  
- Cùng key `pageUi` / `drafts`: last-write-wins theo `savedAt`.  
- Tab cũ có thể toast ngắn “Đã có bản mới trên tab khác” khi nhận message mới hơn (không bắt buộc block UI).

---

## 4. API mặt FE (tối giản)

Một module thin (vd. `packages/shared/src/lib/clientPersist/`):

| API | Việc |
|-----|------|
| `openClientDb(userId)` | Open + ensure stores |
| `clearClientDb()` | Wipe on logout |
| `usePageUiPersist({ routeKey, schemaVersion, fields, scrollRoot })` | Debounced write/read |
| `useDraftPersist({ type, unitId, … })` | Thay dần session helpers LTTP |
| `enqueueOutbox(entry)` / `flushOutbox()` | Create-only queue |
| Query persister + dehydrate filter | Wire trong `AppProviders` (chỉ khi authenticated) |

Reuse pattern debounce / safe parse từ `lttpNhapXuatSessionPersist.js`; **không** giữ song song hai nguồn lâu dài sau migrate.

---

## 5. Rollout phase

| Phase | Nội dung |
|-------|----------|
| **P0** | Infra IDB + clear on logout + self-check nhỏ |
| **P1** | Migrate LTTP drafts/filters từ sessionStorage → `drafts` / `pageUi`; scroll tab Nhập xuất |
| **P2** | React Query persist allowlist catalog |
| **P3** | Outbox create issue slip (X1) |
| **P4** | Opt-in `pageUi` cho các private route khác (nav tab + scroll trước; field form từng trang) |

Mỗi phase ship được độc lập; P3 không block P1/P2.

---

## 6. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|--------|------------|
| Lưu nhầm mật khẩu / token | Deny-list; không persist auth storage vào IDB |
| Cache user A đọc bởi user B | Key theo `userId`; wipe logout |
| Schema UI đổi → hydrate hỏng | `schemaVersion` per page; mismatch → discard fields, giữ draft nếu draft version còn đọc được |
| Quota IDB | Debounce; giới hạn size draft; fail soft (ignore write) |
| Update offline ghi đè | **X1** — không enqueue update |

---

## 7. Kiểm tra tối thiểu (ponytail)

- Self-check / test nhỏ: serialize key `pageUi`, migrate mock sessionStorage → drafts, outbox chỉ nhận `kind` create.  
- Manual: đóng browser → mở lại LTTP draft còn; logout → draft mất; offline create → online flush.

---

## 8. Tiêu chí xong v1

- [x] IDB `quanluong-client` với 4 store (hoặc query persist + 3 object stores).  
- [x] LTTP nháp sống qua đóng browser; migrate từ sessionStorage. _(Task 9: code + `drafts.selfcheck`; đóng/mở browser chưa chạy manual.)_  
- [x] Catalog allowlist persist + TTL.  
- [x] Outbox create-only + flush online.  
- [x] Ít nhất LTTP + hook generic để private pages khác opt-in scroll/fields.  
- [x] Logout xóa sạch dữ liệu client của user. _(Task 9: `authApi` + `clearClientDb`; chưa smoke logout trên browser.)_
