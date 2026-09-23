# Task 6 Report: Wire OfflineProvider + queue flush path

## Status

**DONE** — `OfflineProvider` wires reauth overlay, AUTH_EXPIRED handling, forbidden toast, and `verifySessionOrRefresh`; `useOfflineQueue` prefers provider flush.

## Changes

### `OfflineProvider.jsx`

- Added `reauthRequired` state; cleared on `userId` change alongside reconnect flags.
- Injected `verifySessionOrRefreshFn` into `createOfflineSyncController` with auth store `setAuthState` + `mapPermissionsFromUser`.
- Flush wrapper: `authExpired` → `setReauthRequired(true)`; `forbidden > 0` → `notifyWarning("Bạn không có quyền thực hiện thao tác này")`.
- `runGate` catch: `AUTH_EXPIRED` → `setReauthRequired(true)`, return (keeps `reconnectBlocking`, no `reconnectError`).
- `handleReauthSuccess`: verify session → clear reauth → `runGate()` if saw offline else `flushOutboxFn()`.
- UI: `ReauthOverlay` when `reauthRequired`; reconnect overlay when `reconnectBlocking && !reauthRequired`; pointer-events block when either.

### `useOfflineQueue.js`

- Primary flush/reapply path uses `flushFromProvider()` when `ready && db && userId`.
- Guarded direct `flushOutbox` only before sync controller mounts (`ready` false but `db` present).

### `OfflineProvider.reauth.contract.selfcheck.mjs`

- Static contract asserts required strings in provider source.

## Tests (Step 8)

| Selfcheck | Result |
|-----------|--------|
| `outbox/errors.selfcheck.mjs` | ok |
| `outbox/outbox.selfcheck.mjs` | ok |
| `auth/verifySessionOrRefresh.selfcheck.mjs` | ok |
| `sync/OfflineSyncController.selfcheck.mjs` | ok |
| `runReconnectSync.selfcheck.mjs` | ok |
| `ui/ReauthOverlay.contract.selfcheck.mjs` | ok |
| `OfflineProvider.reauth.contract.selfcheck.mjs` | ok |

TDD: contract selfcheck run before implementation (FAIL), after implementation (ok).

## Manual smoke (Step 9)

**SKIP** — no browser session in this run.

Recommended manual checks:

1. Expire session with pending outbox → `ReauthOverlay` (`Phiên hết hạn, đăng nhập lại`); items stay `pending`.
2. Login same user → overlay closes; flush/reconnect resumes.
3. Mixed 403 + OK → one forbidden toast; no reauth modal.

## Spec coverage (this task)

| Requirement | Covered |
|-------------|---------|
| Resume after login | yes (`handleReauthSuccess`) |
| 403 toast once | yes (provider flush wrapper) |
| No wipe on AUTH_EXPIRED | yes (no draft/outbox clear on auth expired) |

## Commit

```
feat(offline): reauth overlay and forbidden toast on flush
```

## Concerns

- Pre-controller window: `useOfflineQueue` may still call direct `flushOutbox` without verify/toast until `ready`; narrow race only.
- `handleReauthSuccess` calls `runGate()` which sets `reconnectBlocking` again — intended for offline→online path.
