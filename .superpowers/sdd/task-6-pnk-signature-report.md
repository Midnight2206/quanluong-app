# Task 6 Report — PNK signature settings: nhapTaiKho + locked nguoi_giao

**Status:** completed

## Summary

Extended the signature-settings API to persist `extraFieldsJson` as `extraFields`, then updated the PNK signature settings UI to save `nhapTaiKho` and always keep a locked `NGƯỜI GIAO` slot first. Batch export now materializes that slot as `source: "static"` with `static_name` from each slice context's `buyerSignatureName`.

## Files

- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-signature-settings.service.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.validator.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.controller.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js`
- `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuPdfApi.js`
- `packages/shared/src/pages/chungTuQuyetToan/ChungTuSignatureSettingsWorkspace.jsx`
- `packages/shared/src/pages/chungTuQuyetToan/ChungTuQuyetToanPage.test.js`

## Verification

```bash
node --experimental-test-module-mocks --test quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js
node --test packages/shared/src/pages/chungTuQuyetToan/ChungTuQuyetToanPage.test.js
```

Both targeted suites passed locally.

## Notes

- Task 5 review before this work found no critical or important blocker to fix first.
- The locked PNK slot disables delete, key, source, and label edits; layout fields remain editable.
- Batch history still stores the configured signature block, while per-file render payloads get the buyer-materialized `NGƯỜI GIAO` name at export time.
