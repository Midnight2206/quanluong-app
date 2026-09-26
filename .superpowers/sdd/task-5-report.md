# Task 5 Report: Wire `LttpPhieuXuatTab`

## Status

**Done.** Create-mode toolbar button opens `LttpIssueSlipAiSuggestDialog`; apply uses `applyIssueSlipAiPreview` + `headerTouched` + `notifySuccess` toast.

## TDD

1. Added `LttpPhieuXuatTab.ai.contract.selfcheck.mjs` (button copy, dialog, helper, `!isEditMode`, `headerTouched`, toast).
2. Wired `LttpPhieuXuatTab.jsx`: `headerTouched` on five header fields; reset on unit change / discard draft; apply handler patches header + replaces lines.
3. All selfchecks + BE tests → **PASS** (see below).

## Test summary

| Command | Result |
|---------|--------|
| `applyIssueSlipAiPreview.selfcheck.mjs` | PASS |
| `LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs` | PASS |
| `LttpPhieuXuatTab.ai.contract.selfcheck.mjs` | PASS |
| `lttp-issue-slip-ai-enrich.test.js` | PASS (3) |
| `lttp-issue-slip-ai.service.test.js` | PASS (3) |

## Manual smoke

**SKIP** — no browser in this session.

## Commit

`feat(lttp): wire AI suggest into phiếu xuất create form`

Files: `LttpPhieuXuatTab.jsx`, `LttpPhieuXuatTab.ai.contract.selfcheck.mjs`

## Concerns

- Wizard mobile layout: AI button only on desktop action row (`wizardShowDesktopActions`); wizard users on small screens may need a footer entry later.
- Restored IDB draft does not mark `headerTouched`; AI may overwrite draft header fields user had not re-edited (same as fresh create).

---

## Final review fix (TGSX apply)

**Root cause:** BE `resolveIssueSlipAiSuggestLine` returns resolved price in `unitPrice` only; `mapPreviewLineToRow` copied `tgsxPrice` from missing field → TGSX rows had `tgsxPrice: null` after Áp dụng → `resolveIssueSlipAppliedUnitPrice` / TGSX radio disabled.

**Fix:** In `applyIssueSlipAiPreview.js`, when `priceKind === tgsx`, set `tgsxPrice` from `line.tgsxPrice ?? line.unitPrice`; market unchanged. Optional: dialog suggest body now includes `receivedDate` + `recipientUnitId` from tab for LLM context.

**Tests:** `applyIssueSlipAiPreview.selfcheck.mjs` (+ TGSX unitPrice-only case); all three LTTP AI selfchecks PASS.
