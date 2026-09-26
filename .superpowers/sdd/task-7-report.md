# Task 7 Report: Wire `aiSessionId` on tab + link after save

## Status

**DONE** — `LttpPhieuXuatTab` now keeps the AI `sessionId` after Apply, links it to the created issue slip on successful online save, and clears the session on the same reset/unit-change paths as the form.

## Changes

### `packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.jsx`

- Added local `aiSessionId` state in create mode.
- Updated `handleApplyIssueSlipAiPreview(preview, meta)` to accept dialog metadata and store `meta.sessionId`.
- Added `useLinkLttpIssueSlipAiMemoryMutation`.
- On successful online create, when `created.id` and `aiSessionId` are present, now calls `POST /lttp/issue-slips/ai-memory/link` with `{ sessionId, unitId, issueSlipId }`.
- Link failure now shows a soft `notifyError(...)` and does not roll back or block the created slip.
- Cleared `aiSessionId` on unit switch, draft discard/reset, and post-save form reset.
- Added a `ponytail:` comment documenting that offline/outbox linking is intentionally deferred for now.

### `packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.ai.contract.selfcheck.mjs`

- Extended the static contract to assert:
  - `aiSessionId` state exists
  - the tab references the AI memory link hook/route
  - the apply handler accepts `(preview, meta)`
  - the tab stores `meta.sessionId`

## Checks

Verified:

- `node packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.ai.contract.selfcheck.mjs` -> ok
- `node packages/shared/src/features/lttp/api/lttpIssueSlipAi.api.selfcheck.mjs` -> ok
- IDE lints on edited files -> no errors

## Commit

```text
feat(lttp): wire AI memory link after save
```

## Concerns

- Offline/outbox-created slips still do not link AI memory automatically because the tab does not receive the eventual server-created slip id during flush. This is documented inline and left intentionally out of scope for this task.

## Follow-up fix (Important finding)

After offline enqueue create succeeds, the tab now calls `setAiSessionId(null)` alongside `clearIssueSlipPersist()` so a subsequent online create cannot mis-link a stale AI session. The inline `ponytail:` note that offline memory link stays deferred until flush is unchanged on the online reset path and mirrored on the offline enqueue branch.

### Checks (re-run)

- `node packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.ai.contract.selfcheck.mjs` -> ok (includes offline enqueue clears `aiSessionId`)
- `node packages/shared/src/features/lttp/api/lttpIssueSlipAi.api.selfcheck.mjs` -> ok

### Commit

```text
fix(lttp): clear aiSessionId after offline enqueue create
```
