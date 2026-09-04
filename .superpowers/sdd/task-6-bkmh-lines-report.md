# Task 6 Report

- Status: completed
- Commit: `feat(chung-tu): PNK monthly builds lines from BKMH slice snapshots`

## What changed

- Switched monthly `PHIEU_NHAP_KHO` context resolution off LTTP slips onto persisted `ChungTuBkmhSlice.detailRowsJson` snapshots.
- Re-aggregated snapshot rows with the same merge rule as BKMH: same `commodityId` or fallback identity plus same `unitPrice` merges; different prices stay separate.
- Filtered monthly PNK sheets to only days whose BKMH slices contain non-empty `detailRowsJson`.
- Added a clear `AppError` when the month has no usable BKMH monthly/slice data, instead of falling back to LTTP.
- Forced batch PNK monthly export to `by-day` on the backend so legacy FE aggregation selections cannot produce `by-unit` or `full` output.
- Fixed `buildContextBase()` to carry `periodDate`, which the batch slice picker expects for by-day monthly exports.

## Test results

- Passed: `node --test ./src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js`
- Passed: `node --experimental-test-module-mocks --test ./src/modules/chung-tu-quyet-toan/chung-tu-pnk-from-bkmh.service.test.js`
- Passed: `node --experimental-test-module-mocks --test ./src/modules/chung-tu-quyet-toan/chung-tu-bkmh-monthly.service.test.js`
- Passed: `node --experimental-test-module-mocks --test ./src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js`
- Lints: no diagnostics on touched files

## Concerns

- `canCuBkmh` now comes from slice metadata already persisted on `ChungTuBkmhSlice`; because buyer name is not currently stored there, the generated basis text includes document number and date but not buyer identity.
- Backend is locked to `by-day` for monthly PNK, but the FE aggregation picker is still a separate cleanup task if the old control remains visible.
