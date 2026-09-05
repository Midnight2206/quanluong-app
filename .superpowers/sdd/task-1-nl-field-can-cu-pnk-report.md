# Task 1 Report — NL field + label-field modules

Plan: `docs/superpowers/plans/2026-09-05-nl-field-can-cu-pnk.md`
Spec: `docs/superpowers/specs/2026-09-05-nl-field-can-cu-pnk-design.md`

## Status

Completed Task 1 only.

## Done

- Added `chung-tu-named-range-prefix.js` with shared `FIELD_` / `NL_FIELD_` parsing.
- Added `chung-tu-nl-field.js` with `NL_FIELD_can_cu_pnk` catalog metadata, NL key resolution, and `formatCanCuPnkLine` / `formatCanCuPnkText`.
- Added `chung-tu-label-field.js` with `isLabelFieldNamedRange` and moved `formatDerivedNamedRangeValue` there.
- Kept `chung-tu-named-range-display.js` as a compatibility re-export for `formatDerivedNamedRangeValue`.
- Dropped the `cancubkmh` legacy shorthand from `chung-tu-named-range-display.js`.
- Added focused `node:test` coverage for NL formatting, dedup/join behavior, label-field prefix detection, and the compatibility re-export.

## TDD

1. Wrote Task 1 tests first for the new NL module, new label module, and the named-range-display compatibility seam.
2. Ran the targeted test slice and captured the expected red state: `ERR_MODULE_NOT_FOUND` for the new modules before implementation.
3. Implemented the minimum code to satisfy the tests.
4. Re-ran the same targeted slice to green.

## Verification

```bash
cd /Users/midnight/quanluong-app/quanluong-app-be && node --test \
  src/modules/chung-tu-quyet-toan/chung-tu-nl-field.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-label-field.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-named-range-display.test.js
```

Result: `15/15` passing.

## Concerns

- This task intentionally does not wire `canCuPnk` into catalog/alias/resolver/service paths yet; that starts in Task 2.
- The red phase failed at module resolution because the new files did not exist yet; after implementation, the same targeted slice passed cleanly.
