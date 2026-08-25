# Task 5 Report — Node client preview / publish / retire + 409

**STATUS:** completed

## Delivered

- Updated `requestDocument()` to preserve upstream HTTP `409` as `AppError` `statusCode: 409` with `ERROR_CODES.CONFLICT`.
- Added and exported `previewTemplatePdf(templateId)`, `publishTemplate(templateId)`, and `retireTemplate(templateId)` in `src/services/document-service.client.js`.
- Extended the existing lightweight client test file with focused coverage for the new methods and the `TEMPLATE_NOT_PUBLISHED` conflict path.

## Verification

- `node --test quanluong-app-be/src/services/document-service.client.test.js` — pass (`22` tests, `0` failures).
- `ReadLints` on touched files — no errors.

## Commit

- `feat(be): document-service client preview publish retire + 409`
