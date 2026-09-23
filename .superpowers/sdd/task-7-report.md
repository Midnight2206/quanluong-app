# Task 7 Report: Outbox create-only + flush (P3, X1)

## Done

- `packages/shared/src/lib/clientPersist/outbox.js`: `OUTBOX_KIND_CREATE`, `assertCreateOnlyKind` (X1), `enqueueOutbox`, `flushOutbox` (pending→sending→done|failed; 4xx no retry; 5xx/network retries max 5), `isOutboxEligibleError`, `setOutboxStoreForTest`.
- `outbox.selfcheck.mjs`: X1 asserts + mock IDB flush — pass.
- `lttpApi.js`: `enqueueLttpIssueSlipCreateOffline`, re-export `isOutboxEligibleError` / `OUTBOX_KIND_CREATE` (update mutation unchanged).
- `LttpPhieuXuatTab.jsx`: create submit catch enqueues on network/offline + `notifySuccess` queue message (sonner via existing notify).
- `ClientPersistenceProvider.jsx`: `online` listener + initial flush when ready; `invalidateLttpData` after any flush; clears issue-slip draft per flushed create.

## Verification

```bash
node packages/shared/src/lib/clientPersist/outbox.selfcheck.mjs
```

## Manual (Step 5)

DevTools offline → new phiếu xuất → toast queue → online → flush POST → list refetch; update path never enqueues.

## Not committed (per task override).
