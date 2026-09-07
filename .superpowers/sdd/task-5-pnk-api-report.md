# Task 5 Report — PNK API validator + batch date range

**Status:** completed

## Summary

Updated the PNK PDF export API rules so PNK now validates `dateFrom`/`dateTo`, rejects `unitIds`, and only accepts `aggregationMode` `by-day|full`. Batch export no longer forces PNK back to `by-day`; it forwards the requested date range into `resolveChungTuContext()` and reads `nhapTaiKho` from signature settings `extraFields`.

## Files

- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.validator.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-signature-settings.service.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.validator.test.js`
- `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js`
- `.superpowers/sdd/progress.md`

## Verification

```bash
node --test /Users/midnight/quanluong-app/quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.validator.test.js
node --experimental-test-module-mocks --test /Users/midnight/quanluong-app/quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js
node --experimental-test-module-mocks --test /Users/midnight/quanluong-app/quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pnk-from-bkmh.service.test.js
```

All targeted tests passed.

## Progress

- Task 5 implemented and verified locally; batch keeps requested PNK aggregation mode instead of forcing `by-day`.
