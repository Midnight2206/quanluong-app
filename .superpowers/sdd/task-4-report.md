# Task 4 Report: Dialog + API mutation

## Status

**Done.** `useSuggestLttpIssueSlipAiMutation` + `LttpIssueSlipAiSuggestDialog` (prompt → suggest → preview → `onApply(preview)`; no server apply).

## TDD

1. Added `LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs` (title `AI gợi ý phiếu`, mutation hook, `ai-suggest` URL, `Gợi ý` / `Áp dụng`, `onApply`, `notifyError`).
2. Implemented mutation + dialog.
3. `node packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs` → **PASS**.

## Commit

`feat(lttp): AI suggest dialog and API mutation`

Files: `lttpApi.js`, `LttpIssueSlipAiSuggestDialog.jsx`, `LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs`

## Test summary

| Check | Result |
|-------|--------|
| Contract selfcheck | PASS |

## Concerns

- Tab wiring (Task 5) still required for end-to-end UX; dialog not mounted yet.
- Success toast for applied/skipped lines belongs in parent `onApply`, not dialog.
