# Task 5 report: FE API mutations

## Status

**Done**

## Changes

| File | Change |
|------|--------|
| `packages/shared/src/features/lttp/api/lttpApi.js` | Added `useChatLttpIssueSlipAiMutation`, `useCommitLttpIssueSlipAiMemoryMutation`, `useLinkLttpIssueSlipAiMemoryMutation` (mirror `useSuggestLttpIssueSlipAiMutation`: `useWrappedMutation` + `POST` + `body`) |
| `packages/shared/src/features/lttp/api/lttpIssueSlipAi.api.selfcheck.mjs` | Asserts four hook exports and four URL paths |

## Endpoints wired

| Hook | URL |
|------|-----|
| `useSuggestLttpIssueSlipAiMutation` (unchanged) | `/lttp/issue-slips/ai-suggest` |
| `useChatLttpIssueSlipAiMutation` | `/lttp/issue-slips/ai-chat` |
| `useCommitLttpIssueSlipAiMemoryMutation` | `/lttp/issue-slips/ai-memory/commit` |
| `useLinkLttpIssueSlipAiMemoryMutation` | `/lttp/issue-slips/ai-memory/link` |

No cache invalidation on chat/commit/link (same as suggest); callers pass `unitId` and other fields in `body` per BE contract.

## Tests

```text
node packages/shared/src/features/lttp/api/lttpIssueSlipAi.api.selfcheck.mjs  → ok
node packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs  → ok
```

## Concerns / follow-ups

- **Task 6+**: Dialog/tab must import the new hooks; `sessionId` handling lives in UI, not this task.
- **Types**: `lttpApi.js` is untyped JS; response shapes (`sessionId`, preview) remain implicit until UI consumes them.

## Commit

See git log for Task 5 commit on `feat/lttp-issue-slip-ai-memory-chat`.
