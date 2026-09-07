# Task 4 Report: FE NL field split + Superadmin skip

## Scope

Implemented Task 4 only from `docs/superpowers/plans/2026-09-05-nl-field-can-cu-pnk.md`.

## TDD

1. Added failing tests for `chungTuNlField`, `chungTuLabelField`, the compat re-export in `chungTuPdfScalarFieldKey`, and the Superadmin NL skip path.
2. Ran the targeted suite and confirmed red due to missing `chungTuNlField.js` / `chungTuLabelField.js` and missing Superadmin filtering.
3. Implemented the minimum FE changes to satisfy the tests.
4. Re-ran the same targeted suite to green.

## Changes

- Added `packages/shared/src/pages/chungTuQuyetToan/chungTuNlField.js` with `NL_FIELD_` helpers and `resolveNlFieldKey()`.
- Added `packages/shared/src/pages/chungTuQuyetToan/chungTuLabelField.js` and moved `resolvePdfScalarFieldKey()` there.
- Kept `packages/shared/src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.js` as a thin compatibility re-export.
- Updated `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx` to:
  - skip `NL_FIELD_*` when `named_range` / `namedRange` is present,
  - fall back to `resolveNlFieldKey(rawName)` when only scalar keys are present,
  - fabricate `FIELD_*` only for labelable rows with no named range payload.

## Verification

```bash
node --test \
  packages/shared/src/pages/chungTuQuyetToan/chungTuNlField.test.js \
  packages/shared/src/pages/chungTuQuyetToan/chungTuLabelField.test.js \
  packages/shared/src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.test.js \
  packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.test.js
```

Also checked touched files with IDE diagnostics: no linter errors found.

## Notes

- This task does not add FE catalog changes beyond the shared field-key split and Superadmin filtering.
- The fallback path remains in place until template fields consistently include `named_range` from Task 3.
