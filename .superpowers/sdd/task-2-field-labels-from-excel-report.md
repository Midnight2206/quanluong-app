# Task 2 Report — FE template FIELD_* labels

**Status:** completed

## Summary

Added a shared `resolvePdfScalarFieldKey()` helper in `packages/shared` to mirror backend scalar key resolution for template field labels. The Superadmin template editor now builds its label form from the selected template's scalar fields, enriches rows from the catalog when available, removes the old `supportsLabel` gate, and prunes the save payload to only keys present on the current template.

## Verification

```bash
cd packages/shared && node --test src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.test.js src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.test.js
cd quanluong-app-be && node --experimental-test-module-mocks --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js
```

Result: shared/frontend source tests `2 passed`; backend service regression suite `13 passed`.

## Concerns

1. The backend regression test still needs `--experimental-test-module-mocks` under the local `node v26` runtime because that existing suite uses `mock.module`.
2. The UI still depends on document-service scalar field names staying aligned with backend `resolveScalarFieldKey`; this task adds a mirror helper, so future backend alias changes should be mirrored here too.
