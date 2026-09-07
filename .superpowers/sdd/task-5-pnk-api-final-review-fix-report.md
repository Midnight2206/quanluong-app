# Task 5 Final Review Fix — PNK date forwarding

**Status:** completed

## Summary

Fixed the missing PNK `dateFrom` / `dateTo` plumbing across preview and export flows. The controller layer now forwards the validated date range into preview, single-PDF export, and batch export; the preview and single-export services now pass that range through to `resolveChungTuContext()`.

## Files

- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.controller.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-document.service.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export.service.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.controller.test.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-document.service.test.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export.service.test.js`
- `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx`
- `packages/shared/src/pages/chungTuQuyetToan/ChungTuBkmhMonthlySummary.test.js`

## Notes

- Verified `createChungTuPdfExportBatch()` already accepted and forwarded `dateFrom` / `dateTo`; no batch-service production fix was needed.
- Added focused tests that fail if controller/service forwarding is removed.
- Minor FE update: PNK-only aggregation options now use `Theo ngày` and `Nhiều ngày` with buyer-split hints, without changing shared options for other categories.

## Verification

```bash
cd /Users/midnight/quanluong-app/quanluong-app-be && \
  node --experimental-test-module-mocks --test src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.controller.test.js && \
  node --experimental-test-module-mocks --test src/modules/chung-tu-quyet-toan/chung-tu-document.service.test.js && \
  node --experimental-test-module-mocks --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-export.service.test.js && \
  node --experimental-test-module-mocks --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js && \
  cd /Users/midnight/quanluong-app && \
  node --test packages/shared/src/pages/chungTuQuyetToan/ChungTuBkmhMonthlySummary.test.js
```

All focused tests passed locally.
