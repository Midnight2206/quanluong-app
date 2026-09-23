# App-wide draft persist — smoke checklist

After Docker UI rebuild (`:8080`), logged-in:

1. **LTTP** — phiếu xuất nháp còn sau F5; lịch sử filters; đặt hàng date/supplier; chữ ký dirty giữ đến khi Lưu.
2. **Sổ bếp** — manual unit / yearMonth / menuDate; phiếu nhập dirty rows; thực đơn dirty + allowance.
3. **Chấm cơm** — yearMonth; guaranty/ledger dirty maps.
4. **Chứng từ** — export wizard; summary/history selection; chữ ký category dirty.
5. **Admin/SA** — job titles / LTTP admin / matrix / meal rates / create user (password trống sau F5) / units / reject notes / CT PDF templates.
6. **Profile** — mid-edit profile còn; password form không còn sau F5.
7. **Logout** — Application → IndexedDB `quanluong-client` wiped.
8. **Skip** — login, modals, Messenger chat không ghi drafts.

Selfcheck: `node packages/shared/src/lib/clientPersist/db.selfcheck.mjs && node packages/shared/src/lib/clientPersist/drafts.selfcheck.mjs`

9. **Reconnect gate** — Wi‑Fi back → overlay “Đang đồng bộ…” blocks interaction until outbox flush + active-query refetch succeed; API unreachable while Wi‑Fi on → stay offline/degraded, gate error + **Thử lại** (no skip).
10. **Local unsaved marks** — offline edit → blur warning on field → change route → return → marks still visible after draft hydrate; discard draft or successful submit removes marks; login/password/`data-no-persist` fields never marked.

Integration selfchecks (reconnect + marks):

```bash
node packages/shared/src/offline/sync/probeReachability.selfcheck.mjs
node packages/shared/src/offline/sync/networkStatus.selfcheck.mjs
node packages/shared/src/offline/sync/OfflineSyncController.selfcheck.mjs
node packages/shared/src/offline/runReconnectSync.selfcheck.mjs
node packages/shared/src/lib/clientPersist/localUnsavedFieldRegistry.selfcheck.mjs
node packages/shared/src/hooks/useDraftPersist.behavior.selfcheck.mjs
```
