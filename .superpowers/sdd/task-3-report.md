# Task 3 Report: Memory format + recipient history + prompt inject

## Status

**Done.** Added a pure AI memory formatter, extended LTTP issue-slip prompts to inject optional memory/chat context, and made history sampling recipient-aware via a tested `where` builder + `loadHistorySamples` options signature.

## TDD

### Step 1 - Failing tests

Created:

- `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-memory.test.js`
- `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.prompt.test.js`
- extended `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.test.js`

RED cases covered:

- `formatMemoriesForPrompt` prefers rows with `issueSlipId`, caps output at 20, includes prompt + mapped line names + turns, and ignores unmapped lines.
- `buildIssueSlipAiPrompt` injects `Bai hoc AI gan day:` when `memoryText` is present.
- `buildIssueSlipAiChatPrompt` includes catalog, optional memory, current preview JSON, prior turns, and the new message.
- `buildIssueSlipAiHistoryWhere` adds `recipientUnitId` when provided.

### Step 2 - RED

```text
$ node --test /Users/midnight/quanluong-app/quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-memory.test.js

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../lttp-issue-slip-ai-memory.js'
✖ .../lttp-issue-slip-ai-memory.test.js
ℹ pass 0
ℹ fail 1
```

```text
$ node --test /Users/midnight/quanluong-app/quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.prompt.test.js

SyntaxError: The requested module './lttp-issue-slip-ai.prompt.js' does not provide an export named 'buildIssueSlipAiChatPrompt'
✖ .../lttp-issue-slip-ai.prompt.test.js
ℹ pass 0
ℹ fail 1
```

```text
$ node --test /Users/midnight/quanluong-app/quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.test.js

✖ buildIssueSlipAiHistoryWhere adds recipientUnitId when provided
TypeError: buildIssueSlipAiHistoryWhere is not a function
ℹ pass 3
ℹ fail 1
```

### Step 3 - Implement

Created `lttp-issue-slip-ai-memory.js`:

- Sorts memories with linked `issueSlipId` first, then by `updatedAt` desc.
- Caps to 20 rows.
- Truncates prompt text and turn text.
- Formats only mapped preview lines into prompt-friendly bullets.

Updated `lttp-issue-slip-ai.prompt.js`:

- Extracted shared system prompt builder.
- `buildIssueSlipAiPrompt(...)` now accepts optional `memoryText`.
- Added `buildIssueSlipAiChatPrompt(...)` for upcoming chat flow.

Updated `lttp-issue-slip-ai.service.js`:

- Added `buildIssueSlipAiHistoryWhere(storageUnitId, { recipientUnitId })`.
- Changed `loadHistorySamples(storageUnitId, { recipientUnitId, limit })`.
- `suggestIssueSlipAi(...)` now passes `recipientUnitId` into history loading.

### Step 4 - GREEN

Focused Task 3 suite:

```text
$ node --test .../lttp-issue-slip-ai-memory.test.js && node --test .../lttp-issue-slip-ai.prompt.test.js && node --test .../lttp-issue-slip-ai.service.test.js

✔ formatMemoriesForPrompt prefers linked rows, caps at 20, and includes prompt lines and turns
✔ formatMemoriesForPrompt returns fallback when no rows
✔ buildIssueSlipAiPrompt includes memory section when memoryText is present
✔ buildIssueSlipAiChatPrompt includes catalog preview turns and new message
✔ buildIssueSlipAiPrompt system mentions JSON schema; user has prompt and catalog
✔ buildIssueSlipAiHistoryWhere adds recipientUnitId when provided
✔ suggestIssueSlipAi returns headerDraft, lines, warnings, meta without DB write
✔ suggestIssueSlipAi does not put unvalidated body recipientUnitId in headerDraft
ℹ pass 8
ℹ fail 0
```

Neighbor verification:

```text
$ node --test .../lttp-issue-slip-ai-enrich.test.js && node --test .../lttp-issue-slip-ai-header-scope.test.js && node --test .../lttp-issue-slip-ai-tgsx.test.js

ℹ pass 10
ℹ fail 0
```

Lint verification:

```text
ReadLints(paths=[Task 3 files]) -> No linter errors found.
```

## Commit

`feat(lttp): add issue slip AI memory prompt helpers`

## Files

- `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-memory.js`
- `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-memory.test.js`
- `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.prompt.js`
- `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.prompt.test.js`
- `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.js`
- `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.test.js`

## Concerns

- Memory loading/persistence and chat/commit/link HTTP are intentionally not implemented in this task; `buildIssueSlipAiChatPrompt` is added as a pure helper for Task 4 wiring.
- Recipient history filtering only narrows production slip samples; no recipient-specific AI memory query exists yet in Task 3 scope.
