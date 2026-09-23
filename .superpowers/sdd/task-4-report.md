# Task 4 Report: `runReconnectSync` AUTH_EXPIRED branch

## Status
**Complete**

## Changes
- `packages/shared/src/offline/runReconnectSync.js`: After `flushOutbox()`, if `flushResult.authExpired`, throw `Error` with `message` and `code` both `"AUTH_EXPIRED"`; skip partial-flush path and skip `invalidate` / `refetchActive` / `prefetchBoot`.
- `packages/shared/src/offline/runReconnectSync.selfcheck.mjs`: Added case asserting throw shape and zero `invalidate` calls when `authExpired: true`.

## TDD
1. Added failing selfcheck → assertion `authThrown === true` failed (no throw).
2. Implemented auth branch → `node packages/shared/src/offline/runReconnectSync.selfcheck.mjs` → `runReconnectSync: ok`.

## Test summary
| Command | Result |
|---------|--------|
| `node packages/shared/src/offline/runReconnectSync.selfcheck.mjs` | PASS (`runReconnectSync: ok`) |

Existing cases unchanged: happy path, flush throw, partial flush blocks invalidate, needsReview allows sync.

## Concerns
- Provider wiring to catch `AUTH_EXPIRED` and redirect login is **Task 6**, not in scope here.
- If both `authExpired` and `failed > 0` were ever returned together, auth branch wins (checked first); outbox processor behavior should be verified separately if that combo is possible.

## Commit
`feat(offline): surface AUTH_EXPIRED from reconnect sync`
