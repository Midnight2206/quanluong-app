# Task 7–8 Report — service + HTTP routes

**Status:** DONE (controller committed after implementer forgot commit)

**Commits:**
- `1883e27` feat(chung-tu): PDF template publish retire preview service
- `b6abf1d` feat(chung-tu): PDF template lifecycle HTTP routes

## Delivered
- Service: status-based list (`includeNonPublished`), publish/retire/preview, fields allowNonPublished
- Export services require `status: "published"`
- Routes: preview GET, publish POST, retire POST; DELETE maps to retire
- Validator: `includeNonPublished`
- Tests: template + export suites pass (14+ in combined run)

## Tests
```
node --experimental-test-module-mocks --test \
  chung-tu-pdf-template.service.test.js \
  chung-tu-pdf-export.service.test.js \
  chung-tu-pdf-export-batch.service.test.js
→ pass
```

## Follow-up Fix
- Preview proxy now streams the document-service response through `pipeDocumentServiceResponse` instead of buffering the PDF in the controller/service path.
- Added `previewTemplatePdfResponse(templateId)` in the document-service client and a fallback `inline; filename="preview-<templateId>.pdf"` header when upstream omits `Content-Disposition`.
- List query now accepts both canonical `includeNonPublished` and legacy `includeInactive`, normalizing to `includeNonPublished` so the current Superadmin frontend keeps working until Task 9.

### Verification
```bash
node --experimental-test-module-mocks --test \
  src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.validator.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js \
  src/services/document-service.client.test.js
```
