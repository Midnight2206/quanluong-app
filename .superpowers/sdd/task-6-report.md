# Task 6 Report — Integration smoke checklist

**Status:** DONE

## Selfchecks (Step 1)

| Script | Result |
|--------|--------|
| `probeReachability.selfcheck.mjs` | PASS (`ok`) |
| `networkStatus.selfcheck.mjs` | PASS (`ok`) |
| `OfflineSyncController.selfcheck.mjs` | PASS (`ok`) |
| `runReconnectSync.selfcheck.mjs` | PASS (`ok`) |
| `localUnsavedFieldRegistry.selfcheck.mjs` | PASS (`ok`) |
| `useDraftPersist.behavior.selfcheck.mjs` | PASS (`ok`) |

## Browser checklist — spec §6 (Step 2)

| # | Scenario | Result |
|---|----------|--------|
| 1 | Offline → edit → blur mark → navigate → return → marks after hydrate | **SKIPPED** — Chrome DevTools MCP unavailable (`Transport closed`) |
| 2 | Online → overlay blocks → then usable | **SKIPPED** — same |
| 3 | API down, Wi‑Fi on → offline/gate + Thử lại | **SKIPPED** — same |
| 4 | After gate, active LTTP queries refetch (Network tab) | **SKIPPED** — same |
| 5 | Discard/submit → marks gone | **SKIPPED** — same |
| 6 | Password fields never marked | **SKIPPED** — same |

Manual: Docker UI `:8080`, logged-in; use items 9–10 in `docs/superpowers/specs/2026-09-23-app-wide-draft-persist-smoke.md`.

## Doc update (Step 3)

Appended reconnect gate + local unsaved marks bullets and integration selfcheck block to `docs/superpowers/specs/2026-09-23-app-wide-draft-persist-smoke.md`.

## Commit

`57f8cfa` — docs(smoke): reconnect gate and local unsaved marks checklist (smoke doc only).

## Concerns

- All §6 browser acceptance still unverified in this session; run manual smoke before release.
- Probe/auth edge (401 during gate) not exercised here.

---

## Final whole-branch review — reconnect gate fixes

**Status:** DONE

### Fixes

1. **Partial outbox flush** — `runReconnectSync` throws when `flushOutbox` returns `failed > 0`; gate catch keeps `reconnectBlocking` true and shows overlay + Thử lại. `needsReview` alone still completes the gate (conflict dock).
2. **userId change reset** — `OfflineProvider` clears `sawOfflineRef`, `reconnectBlocking`, `reconnectError`, and bumps `runIdRef` on every `userId` change (including logout).
3. **45s timeout** — `runGate` races `runReconnectSync` against 45_000 ms; timeout shows Vietnamese error + Thử lại.

### Selfchecks

| Script | Result |
|--------|--------|
| `runReconnectSync.selfcheck.mjs` | PASS (`ok`) — includes partial-flush throw + needsReview unlock cases |

### Remaining concerns

- Timeout does not abort in-flight flush/refetch (overlay dismisses on timeout while work may continue in background).
