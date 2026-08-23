# Task 4 Report: PDF Template Service + HTTP

## Status

Implemented the backend PDF template list/upload/delete/fields flow for `chung-tu-quyet-toan`, scoped to HTTP + metadata only. PDF export/storage wiring remains out of scope for this task.

## Implemented

- Added `chung-tu-pdf-template.service.js` with list, create, deactivate, and fields use cases backed by `prisma.chungTuPdfTemplate`.
- Extended `chung-tu-quyet-toan.validator.js` with query/params/multipart schemas for `/pdf-templates`.
- Added READ/WRITE route definitions and wired four authenticated routes in `chung-tu-quyet-toan.routes.js`.
- Added thin controllers in `chung-tu-quyet-toan.controller.js` using `respondSuccess` / `respondCreated`.
- Confirmed the upstream document-service upload payload uses `id`, with a guarded fallback for `template_id`.
- Added `chung-tu-pdf-template.validator.test.js` as a focused boundary test for the new request schemas.

## Verification

- `node --test /Users/midnight/quanluong-app/quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.validator.test.js` passed.
- `node --input-type=module -e "await import('file:///Users/midnight/quanluong-app/quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.js'); await import('file:///Users/midnight/quanluong-app/quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.controller.js'); await import('file:///Users/midnight/quanluong-app/quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.routes.js'); console.log('module smoke ok')"` passed with inert runtime env vars.
- Edited files have no IDE linter diagnostics.
- Existing `src/services/document-service.client.test.js` still has a pre-existing failure in `renderDocumentPdf` expectations and was not changed as part of Task 4.

## Commit

Planned message: `feat(chung-tu): PDF template list/upload/fields API`

## Concerns

- Repository is already dirty outside Task 4, so staging must stay limited to the PDF template files plus this report.
- There is no existing authenticated API test harness for this module, so verification is limited to schema tests and module smoke loading.

## Review fix (2026-08-23)

- Added `chung-tu-pdf-template.service.test.js` with `node:test` `mock.module` mocks for document-service client + prisma (no live HTTP/DB).
- Reused `CHUNG_TU_CATEGORY_KEYS` allowlist in service + validator (`chungTuPdfCategoryKeySchema`).

### Test command

```bash
node --test --experimental-test-module-mocks \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.validator.test.js
```

### Test output

```
✔ listChungTuPdfTemplates filters by categoryKey and isActive
✔ createChungTuPdfTemplate uploads then persists document-service template id
✔ deactivateChungTuPdfTemplate soft-deletes active row
✔ getChungTuPdfTemplateFields loads fields from document service
✔ unsupported categoryKey throws validation AppError
✔ chungTuPdfTemplateListQuerySchema requires a trimmed category key
✔ chungTuPdfTemplateIdParamSchema coerces numeric ids
✔ chungTuPdfTemplateUploadBodySchema normalizes multipart fields
ℹ tests 8 | pass 8 | fail 0
```

### Commit

`test(chung-tu): mock PDF template service unit tests`
