# Task 4 Report — Resolve system signature slots at PDF export

**Status:** completed

## Summary

Wired system signature slot resolution into the PDF export flow. System slots are resolved at export time via `SIGNATURE_CATALOG`; static/prompt slots pass through unchanged with `resolvedName`/`resolvedTitle` set to `null`. BKMH header buyer name/department now prefer catalog-resolved values over slip/header fallbacks.

## Commit

- `c950932` — `feat(chung-tu): resolve system signature slots at PDF export time`

## Call sites modified

| File | Change |
|------|--------|
| `chung-tu-data-resolver.service.js` | Added `resolveSystemSignatureSlots()`; `resolvePdfHeaderSettings()` accepts `resolvedBkmhBuyer`; `resolveChungTuContext()` accepts and forwards `resolvedBkmhBuyer` to `resolveSettingsForSlips` → `resolvePdfHeaderSettings` |
| `chung-tu-pdf-export.service.js` | `createChungTuPdfExport()`: resolves system slots + BKMH buyer before `resolveChungTuContext()`; passes `resolvedBkmhBuyer` into context; passes `resolvedSignatureBlock` to `buildDocumentServicePayload()` |
| `chung-tu-data-resolver.service.test.js` | 3 new tests: system slot resolve, missing catalog node, `resolvedBkmhBuyer` priority |

## Test results

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js
```

**14 passed, 0 failed**

Note: Task brief specified `npx vitest run` but the test file uses `node:test` (consistent with existing suite). Vitest is not in `package.json` devDependencies.

## Concerns

1. **Batch export not wired yet** — `chung-tu-pdf-export-batch.service.js` and `chung-tu-bkmh-monthly.service.js` still call `resolveChungTuContext` / `buildDocumentServicePayload` without system slot resolution. Single PDF export path is covered; batch paths may need the same wiring in a follow-up.
2. **DB stores unresolved signatureBlock** — `signaturesJson.signatureBlock` in the export row still saves the original (unresolved) block; only the document-service payload gets resolved slots. This is intentional (resolved values are ephemeral) but worth noting for re-render flows.
3. **BKMH buyer resolved twice for BKMH exports** — once for header (`resolvedBkmhBuyer`) and again per system slot if a slot uses `bkmh.nguoiMua`. Acceptable for now; could dedupe with a shared cache if it becomes hot.

## Progress

- Reviewed commit `fbdea5a` for Task 4 follow-up readiness: no critical or important blocker found before Task 5.
