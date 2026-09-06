# Task 2 Report — move template field labels editor into modal

**Status:** completed

## Commit

- Planned message: `feat(chung-tu): move template field labels editor into modal`

## Files modified

| File | Change |
|------|--------|
| `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx` | Moved the field labels editor out of the main page into a fixed overlay modal, added `Nhãn field` entry points on template rows and the selected-template header, and kept the existing save mutation/read-only behavior |
| `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.test.js` | Added TDD source assertions for modal dialog markup, modal open flow, preserved save action, and removal of the old inline labels copy from the main section |

## TDD notes

1. Updated the existing source test first to require dialog markup, modal-open state, and the new modal heading.
2. Ran the targeted test to confirm it failed because the modal implementation was missing.
3. Implemented the smallest FE change: modal state, modal overlay markup, row/header open buttons, and preserved label draft/save logic.
4. Re-ran the targeted test until it passed.

## Verification

- `node --test packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.test.js`
- `ReadLints` on the touched shared page and test files returned no errors.

## Concerns

1. This task intentionally keeps the scalar fields / table columns / signature schema outside the modal, per plan.
2. Verification is source-test based; I did not run a browser interaction test for the modal in this task.
