# Task 4 Report: BE service session/chat/commit/link + HTTP

## Status

**Done.** Added LTTP issue-slip AI session persistence, memory-aware suggest/chat flows, commit/link mutations, and the matching HTTP endpoints/rate-limit wiring.

## TDD

### Step 1 - Failing tests

Extended `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.test.js` with RED cases for:

- `suggestIssueSlipAi(...)` creating an early memory row with `finalPreview: null`, `turns: []`, and returning `sessionId`.
- recipient-scoped history loading via `recipientUnitId`.
- TGSX line dropping when the prompt does not signal TGSX.
- `chatIssueSlipAi(...)` appending user + assistant turns and rejecting once the session already has 20 turns.
- `commitIssueSlipAiMemory(...)` storing `finalPreview`.
- `linkIssueSlipAiMemory(...)` linking `issueSlipId` only when the session/slip belong to the same unit.

### Step 2 - RED

```text
$ node --test quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.test.js

✖ suggestIssueSlipAi returns headerDraft, lines, warnings, meta without DB write
  AssertionError: expected sessionId but got undefined

✖ suggestIssueSlipAi passes recipientUnitId into history loader and drops TGSX when prompt does not signal it
  AssertionError: expected 0 lines after TGSX filter, got 1

✖ chatIssueSlipAi appends user and assistant turns and returns sessionId
  TypeError: chatIssueSlipAi is not a function

✖ chatIssueSlipAi rejects when session already has 20 turns
  TypeError: chatIssueSlipAi is not a function

✖ commitIssueSlipAiMemory sets finalPreview for the session
  TypeError: commitIssueSlipAiMemory is not a function

✖ linkIssueSlipAiMemory links issueSlipId only when session belongs to unit
  TypeError: linkIssueSlipAiMemory is not a function
```

### Step 3 - GREEN implementation

Updated `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.js`:

- `suggestIssueSlipAi(...)`
  - creates an early `LttpIssueSlipAiMemory` row with `sessionId`
  - loads recent memories and injects `memoryText` into `buildIssueSlipAiPrompt(...)`
  - keeps recipient-scoped history sampling
  - applies `dropTgsxUnlessSignaled(...)` after enrich
  - returns `sessionId` plus `meta.historySampleCount`, `meta.memorySampleCount`, `meta.model`
- added `chatIssueSlipAi(...)`
  - loads and validates session ownership by `unitId`
  - caps chat at 20 stored turns
  - builds prompt with `buildIssueSlipAiChatPrompt(...)`
  - appends short assistant memory text back into `turns`
- added `commitIssueSlipAiMemory(...)`
  - stores `finalPreview`
- added `linkIssueSlipAiMemory(...)`
  - verifies the issue slip belongs to the same unit before linking

Updated HTTP wiring:

- `quanluong-app-be/src/modules/lttp/lttp.validator.js`
  - `aiChatIssueSlipBodySchema`
  - `aiMemoryCommitBodySchema`
  - `aiMemoryLinkBodySchema`
- `quanluong-app-be/src/modules/lttp/lttp.controller.js`
  - `chatIssueSlipAiController`
  - `commitIssueSlipAiMemoryController`
  - `linkIssueSlipAiMemoryController`
  - `suggestIssueSlipAiController` now passes `actorUserId`
- `quanluong-app-be/src/modules/lttp/lttp.routes.js`
  - `POST /api/lttp/issue-slips/ai-chat`
  - `POST /api/lttp/issue-slips/ai-memory/commit`
  - `POST /api/lttp/issue-slips/ai-memory/link`
  - all registered before `/:id`
- `quanluong-app-be/src/modules/lttp/lttp.route-definitions.js`
  - route-definition entries for the new endpoints
- `quanluong-app-be/src/middlewares/lttp-issue-slip-ai-rate-limit.middleware.js`
  - exported chat limiter with key prefix `lttp-issue-ai-chat:`

### Step 4 - GREEN verification

Focused Task 4 slice:

```text
$ node --test quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.test.js

ℹ pass 9
ℹ fail 0
```

Related LTTP AI suite:

```text
$ node --test quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai*.test.js

ℹ pass 23
ℹ fail 0
```

HTTP syntax check:

```text
$ node -e "... await import('./quanluong-app-be/src/modules/lttp/lttp.routes.js') ..."
routes-ok
```

Lint verification:

```text
ReadLints(paths=[edited Task 4 files]) -> No linter errors found.
```

## Commit

`feat(lttp): AI issue-slip session chat + memory APIs`

## Files

- `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.js`
- `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.test.js`
- `quanluong-app-be/src/modules/lttp/lttp.validator.js`
- `quanluong-app-be/src/modules/lttp/lttp.controller.js`
- `quanluong-app-be/src/modules/lttp/lttp.routes.js`
- `quanluong-app-be/src/modules/lttp/lttp.route-definitions.js`
- `quanluong-app-be/src/middlewares/lttp-issue-slip-ai-rate-limit.middleware.js`
- `.superpowers/sdd/task-4-report.md`

## Concerns

- `commit`/`link` endpoints intentionally return `data: null`; if Task 5 wants richer client UX, that response shape may need expansion.
- Reused permission code `lttp.issue-slips.write`, so no new `permission-catalog.vi.js` entry was needed.

## Follow-up Fixes

### Review findings addressed

- Memory rows now use `dataScope.storageUnitId` consistently in `suggestIssueSlipAi(...)`, `chatIssueSlipAi(...)`, `commitIssueSlipAiMemory(...)`, `linkIssueSlipAiMemory(...)`, and `loadMemories(...)`.
- Session ownership checks now compare the stored memory `unitId` against `storageUnitId`; linked issue slips are validated against the same storage unit.
- `chatIssueSlipAi(...)` now resolves effective prices using `currentPreview.headerDraft.issueDate` first, then payload `issueDate`, and only falls back to today when both are missing.
- Service tests now cover logical-vs-storage unit mismatches and assert that chat passes the preview draft date into `getEffectivePrices(...)`.

### Fresh verification

```text
$ node --test quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai*.test.js

ℹ pass 23
ℹ fail 0
```

Lint verification:

```text
ReadLints(paths=[lttp-issue-slip-ai.service.js, lttp-issue-slip-ai.service.test.js]) -> No linter errors found.
```
