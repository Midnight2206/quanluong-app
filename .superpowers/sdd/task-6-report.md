# Task 6 Report: FE dialog chat + commit on Apply

## Status

**DONE** — `LttpIssueSlipAiSuggestDialog` now keeps the AI `sessionId`, supports follow-up chat against the current preview, commits AI memory on Apply, and resets all local state on close.

## Changes

### `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.jsx`

- Added `useChatLttpIssueSlipAiMutation` and `useCommitLttpIssueSlipAiMemoryMutation`.
- Stored `sessionId` separately from the preview payload after `ai-suggest`.
- Added chat UI/state (`chatMessage`, local `turns`) shown only after a preview exists.
- Wired chat submit to `POST /lttp/issue-slips/ai-chat` with `{ sessionId, unitId, message, currentPreview }`, then replaced the preview with the returned draft.
- Changed Apply flow to `await commit({ sessionId, unitId, finalPreview: preview })` before calling `onApply(preview, { sessionId })`.
- Commit failure now shows `notifyError(...)` and does not apply/close.
- Close path now clears prompt, preview, session, chat input, and local turns.

### `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs`

- Extended the static contract to require `sessionId`, chat wiring, and commit wiring in the dialog source and matching hooks/routes in `lttpApi.js`.

## Checks

TDD sequence:

- `node packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs` → **FAIL** before implementation
- `node packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs` → **ok** after implementation

Final verification:

- `node packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs` → ok
- `node packages/shared/src/features/lttp/api/lttpIssueSlipAi.api.selfcheck.mjs` → ok
- IDE lints on edited dialog/selfcheck files → no errors

## Commit

```text
feat(lttp): add AI issue slip chat apply flow
```

## Concerns

- `LttpPhieuXuatTab` still ignores the second `onApply` argument for now, which matches the task brief; Task 7 needs to persist/link `sessionId` after create.
- Chat history shown in the dialog is local UI feedback only; the backend remains the source of truth for stored turns.
