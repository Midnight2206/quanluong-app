# Task 2 Report — wire canCuPnk and NL field catalog

Plan: `docs/superpowers/plans/2026-09-05-nl-field-can-cu-pnk.md`
Spec: `docs/superpowers/specs/2026-09-05-nl-field-can-cu-pnk-design.md`

## Status

Completed Task 2 only.

## Done

- Replaced the legacy PNK catalog row with `NL_FIELD_can_cu_pnk` and `fieldKey: canCuPnk`.
- Wired backend scalar resolution to strip `NL_FIELD_`, resolve `can_cu_pnk -> canCuPnk`, and reject legacy `can_cu_bkmh` / `canCuBkmh`.
- Switched PNK resolver context output from `canCuBkmh` to `canCuPnk` and reused `formatCanCuPnkText` from `chung-tu-nl-field.js`.
- Updated the monthly BKMH basis service to delegate formatting through the NL formatter path and set `ctx.canCuPnk`.
- Renamed PNK derived named-range config to `canCuPnk` in backend constants, template mapping, and shared category config.
- Updated focused backend and shared tests for the new named range, comma-joined text, and the removed legacy aliases.

## TDD

1. Changed the targeted backend/shared tests first for catalog, alias resolution, PNK context output, monthly basis formatting, and shared category config.
2. Ran the focused suite in red and confirmed the expected feature gaps before implementation.
3. Implemented the minimum wiring to make those expectations pass.
4. Re-ran the same focused suite with the repo's env and module-mock flag to green.

## Verification

```bash
cd /Users/midnight/quanluong-app && \
DATABASE_URL='mysql://test:test@localhost/test' \
JWT_ACCESS_SECRET='test-jwt-secret' \
SESSION_SECRET='test-session-secret' \
node --experimental-test-module-mocks --test \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pnk-from-bkmh.service.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pnk-bkmh-basis.service.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-template-fill-config.service.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-recipient-unit-fill.service.test.js \
  packages/shared/src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.test.js \
  packages/shared/src/pages/chungTuQuyetToan/chungTuCategoryConfig.test.js
```

Result: `33/33` passing.

## Concerns

- Task 3 document-service importer work is intentionally untouched.
- The focused verification emits Node's experimental warning for `--experimental-test-module-mocks`, but the tests still pass cleanly.
