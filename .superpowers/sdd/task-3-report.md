# Task 3 Report: Controller proactive verify

## Status

**Done.** `OfflineSyncController.flush` calls injectable `verifySessionOrRefreshFn` before `flushOutboxImpl`; failed verify returns `{ ...EMPTY, authExpired: true }` without invoking the outbox processor.

## TDD

1. Extended `OfflineSyncController.selfcheck.mjs` with auth short-circuit case and full flush result shape (`authExpired`, `forbidden`).
2. Ran selfcheck — **FAIL** (`authExpired` false, `flushCalls` 1) as expected before controller change.
3. Implemented `verifySessionOrRefresh` wiring and `EMPTY` constant in `OfflineSyncController.js`.
4. Ran selfcheck — **PASS** (`OfflineSyncController: ok`).

## Commit

```
feat(offline): verify session before outbox flush
```

Files: `OfflineSyncController.js`, `OfflineSyncController.selfcheck.mjs`

## Test summary

| Check | Result |
|-------|--------|
| `node packages/shared/src/offline/sync/OfflineSyncController.selfcheck.mjs` | PASS |
| Concurrent flush dedupe (existing) | PASS |
| Verify fail → no `_flushOutboxForTest`, `authExpired: true`, `flushed: 0` | PASS |

## Out of scope (Task 6)

- `OfflineProvider` does not inject `setAuthState` / auth store into `verifySessionOrRefreshFn` yet. Controller default uses `verifySessionOrRefresh` with `apiRequest` only (sufficient for selfcheck and flush gating).

## Concerns

- None blocking. Production flush still relies on default verify hitting `/auth/current-user`; Task 6 will wire persisted auth refresh semantics in the provider.
