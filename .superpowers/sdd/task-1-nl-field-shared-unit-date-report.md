# Task 1 Report — NL_FIELD Shared Unit/Date

**Status:** DONE

## Implemented

- Added `NL_FIELD_don_vi`, `NL_FIELD_don_vi_cap_tren`, and `NL_FIELD_ngay_thang_nam` to backend `chung-tu-nl-field.js` and frontend `chungTuNlField.js`.
- Removed `FIELD_don_vi`, `FIELD_don_vi_cap_tren`, and `FIELD_ngay_thang_nam` from the PDF scalar field catalog.
- Updated backend/frontend scalar resolvers so:
  - `NL_FIELD_*` and bare template field names still resolve to `donVi`, `donViCapTren`, `ngayThangNam`
  - legacy `FIELD_don_vi`, `FIELD_don_vi_cap_tren`, `FIELD_ngay_thang_nam` no longer resolve
- Updated targeted backend/frontend tests for the new contract.

## Verification

Backend targeted tests passed with required env vars:

```bash
cd quanluong-app-be && DATABASE_URL=mysql://test:test@localhost/test JWT_ACCESS_SECRET=test-jwt-secret SESSION_SECRET=test-session-secret node --test ./src/modules/chung-tu-quyet-toan/chung-tu-nl-field.test.js
cd quanluong-app-be && DATABASE_URL=mysql://test:test@localhost/test JWT_ACCESS_SECRET=test-jwt-secret SESSION_SECRET=test-session-secret node --test ./src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.test.js
cd quanluong-app-be && DATABASE_URL=mysql://test:test@localhost/test JWT_ACCESS_SECRET=test-jwt-secret SESSION_SECRET=test-session-secret node --test ./src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js
cd quanluong-app-be && DATABASE_URL=mysql://test:test@localhost/test JWT_ACCESS_SECRET=test-jwt-secret SESSION_SECRET=test-session-secret node --test ./src/modules/chung-tu-quyet-toan/chung-tu-pdf-map.util.test.js
cd quanluong-app-be && DATABASE_URL=mysql://test:test@localhost/test JWT_ACCESS_SECRET=test-jwt-secret SESSION_SECRET=test-session-secret node --test ./src/modules/chung-tu-quyet-toan/chung-tu-template-fill-config.service.test.js
```

Frontend targeted tests passed:

```bash
cd packages/shared && node --test ./src/pages/chungTuQuyetToan/chungTuNlField.test.js
cd packages/shared && node --test ./src/pages/chungTuQuyetToan/chungTuLabelField.test.js
cd packages/shared && node --test ./src/pages/chungTuQuyetToan/chungTuPdfScalarFieldKey.test.js
```

## Concerns

- `chung-tu-pdf-template.service.test.js` currently fails under local Node `v26.4.0` because `node:test` lacks `mock.module` in this runtime. This appears to be a pre-existing test-runtime mismatch, not a regression from this task.
- Ops follow-up from the spec still applies: Excel templates must rename the three Named Ranges to `NL_FIELD_*`.
