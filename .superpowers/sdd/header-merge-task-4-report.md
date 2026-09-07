# Header Merge Task 4 Report — resolver + catalog + PDF field mapping

**Status:** completed

## Delivered

- Resolver now fills `donViCapTren` / `donVi` from the exporting user's `profile` on the PDF export path, and keeps `donViSo` aligned to `profile.donVi` for older templates.
- BKMH header resolution now prefers slip buyer data when present, otherwise falls back to `ChungTuBkmhHeaderSettings.hoTenNguoiMua`; `boPhan` falls back to BKMH header settings only when the current doc/slip value is empty.
- Added `FIELD_ho_ten_nguoi_mua` to the PDF field catalog and mapped `nguoi_mua` / `ho_ten_nguoi_mua` aliases to `hoTenNguoiMua`.
- PDF export, batch export, and preview context flows now pass the exporting user profile through to the shared resolver.

## TDD Notes

- Added failing resolver tests for:
  - exporting profile winning the two đơn vị lines
  - slip buyer winning over BKMH header settings
  - empty slip buyer falling back to BKMH header settings
- Added alias regression coverage for `FIELD_ho_ten_nguoi_mua` and `FIELD_nguoi_mua`.
- Extended PDF export and batch export tests to verify `exportingUserProfile` is forwarded into `resolveChungTuContext`.

## Verification

- `node --test quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js`
- `node --experimental-test-module-mocks --test quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export.service.test.js quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js`
- IDE lints: none on edited files

## Concerns

- Stored document re-resolve paths that do not have an exporting user profile still keep their previous fallback behavior; this task updates the active PDF export/preview flow requested in the brief.

## Commit

- Pending
