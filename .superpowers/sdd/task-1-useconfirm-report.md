# Task 1 Report — replace `window.confirm` with `useConfirm`

**Status:** completed

## Summary

- Replaced every native confirm call in `packages/shared` with `useConfirm()`.
- Delete flows now use `variant: "danger"`; unsaved/continue flows use `variant: "default"`.
- Added a focused source-assert test to keep those four migrated pages off native confirm.

## Files modified

| File | Change |
|------|--------|
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuHistoryWorkspace.jsx` | Replaced 2 delete confirms with `await confirm({ variant: "danger" })` |
| `packages/shared/src/pages/profile/ProfilePage.jsx` | Replaced avatar delete confirm with `await confirm({ variant: "danger" })` |
| `packages/shared/src/pages/kitchen-books/KitchenMenuTab.jsx` | Replaced 3 unsaved-change confirms with `await confirm({ variant: "default" })` |
| `packages/shared/src/pages/kitchen-books/KitchenMenuAiSuggestDialog.jsx` | Replaced overwrite-day confirm with `await confirm({ variant: "default" })` |
| `packages/shared/src/pages/useConfirmReplaceWindowConfirm.test.js` | Added source asserts for zero native confirm usage in migrated files |

## Verification

- `rg 'window\.confirm' packages/shared` → `0` matches
- `node --test packages/shared/src/pages/useConfirmReplaceWindowConfirm.test.js` → `1` pass, `0` fail
- `ReadLints` on edited files → no errors

## Concerns

- Manual browser QA was not run in this session; verification here is source/test-level only.
