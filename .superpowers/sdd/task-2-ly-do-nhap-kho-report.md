# Task 2 Report — PNK `lyDoNhapKho`

**Status:** completed

## Summary

- Added catalog support for `FIELD_ly_do_nhap_kho` -> `lyDoNhapKho` with `supportsLabel: true`.
- Mirrored the scalar alias in both BE and FE field-key resolvers.
- Extended PNK signature settings `extraFields` + UI to save/load `lyDoNhapKho` alongside `nhapTaiKho`.
- Forwarded `lyDoNhapKho` through PNK batch export and resolver contexts, including source hash inputs.

## Tests

- `cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.test.js`
- `cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js`
- `cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js`
- `cd quanluong-app-be && node --experimental-test-module-mocks --test src/modules/chung-tu-quyet-toan/chung-tu-pdf-export-batch.service.test.js`
- `cd quanluong-app-be && node --experimental-test-module-mocks --test src/modules/chung-tu-quyet-toan/chung-tu-pnk-from-bkmh.service.test.js`
- `cd packages/shared && node --test src/pages/chungTuQuyetToan/chungTuLabelField.test.js src/pages/chungTuQuyetToan/ChungTuQuyetToanPage.test.js`

## Concerns

- The `mock.module` backend tests require `node --experimental-test-module-mocks` in this environment.
- Template data still needs the named range `FIELD_ly_do_nhap_kho` added on the uploaded PNK Excel template for rendered output to show the new field.
