# Final P3 Review Fix — Mobile bottom nav flex

**Status:** completed

## Important fix

- `AppSidebar.jsx` mobile bottom nav items: replaced `shrink-0` with `flex-1` (kept `min-w-[3.25rem]` / `sm:min-w-[4rem]`).
- Container unchanged: no `justify-around`; `overflow-x-auto` retained.
- 6-item main app fills bar; 8-item portal still overflows and scrolls.

## Optional (cheap)

- Removed unused `Building2` import from `DashboardTabPages.jsx`.
- Removed empty `async redirects() { return []; }` from `apps/superadmin/next.config.mjs`.

## Tests

```bash
cd packages/shared && node --test src/layouts/components/AppSidebar.test.js src/pages/dashboard/DashboardTabPages.test.js
```

- 2 passed, 0 failed
- AppSidebar test asserts `overflow-x-auto`, `flex-1` on mobile items, and no `shrink-0` on mobile item shell.

## Commit

`fix(ui): keep flex-1 on mobile bottom nav items`

**SHA:** `91ec54427b1af5b436ba7c8410e76205deab8708`

---

# Final whole-branch review — IndexedDB persistence

**Status:** completed (not committed)

## 1. Outbox stuck `sending`

- `flushOutbox` now resets every `sending` row for the active `userId` to `pending` before building the queue.
- **ponytail ceiling:** no time-based stale gate; any prior in-flight `sending` is retried on the next flush (possible duplicate POST if the server succeeded but the client died before marking `done`).

## 2. Auth teardown wipe (`wipeClientPersist`)

- New `packages/shared/src/lib/clientPersist/wipeClientPersist.js`: `clearClientDb()` + `clearQueryPersistCache(userId)`, errors swallowed.
- **useLogoutMutation:** uses `wipeClientPersist` (same behavior as before).
- **fetchCurrentUser:** when `data == null`, captures `userId` before `clearAuthState`, then wipes.
- **useLoginMutation onSuccess:** captures `previousUserId` before `setAuthState`; if it differs from the new user id, wipes the previous user's persist.

## 3. Superadmin parity

- `apps/superadmin/package.json`: added `@tanstack/query-async-storage-persister`, `@tanstack/react-query-persist-client`, `idb-keyval` (aligned with web).
- `apps/superadmin/app/(private)/layout.jsx`: wrapped `MainLayout` with `ClientPersistenceProvider` (nav scroll / page UI persist parity).

## Tests

```bash
node packages/shared/src/lib/clientPersist/outbox.selfcheck.mjs
```

- Exit 0 — enqueue, flush, and stale-`sending`→flush recovery asserted.

## Remaining concerns

- Outbox recovery is blunt (all `sending`→`pending`); idempotent server handling or a `sendingSince` timestamp would narrow duplicate POST risk.
- `wipeClientPersist` is best-effort; `clearClientDb` may be blocked if another tab holds IDB open (`db.js` already resolves `onblocked`).
- Superadmin lockfile not refreshed in this pass — run `npm install` at repo root before superadmin build if deps were not yet hoisted.
