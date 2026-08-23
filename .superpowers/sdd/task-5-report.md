# Task 5 Report — ChungTu PDF batch + signature settings schema

**STATUS:** completed

## Delivered

- Added `ChungTuPdfExportBatch` model: `batchKey` (unique), scope fields (`categoryKey`, `unitId`, period/issue slip), `unitIdsJson`, `aggregationMode`, template/folder IDs, `displayName`, `fileCount`, optional hash/signatures snapshot, `createdById`, timestamps; index `(categoryKey, unitId, createdAt)`; relations to `Unit`, `User`, and child `ChungTuPdfExport[]`.
- Added `ChungTuSignatureSettings` model: unique `categoryKey`, `signatureBlockJson`, `updatedById`, timestamps; relation to `User`.
- Extended `ChungTuPdfExport`: optional `batchId` (FK cascade), `documentServiceFileId`, `sortKey`; `storagePath` now nullable for legacy MEDIA_ROOT exports.

## Migration

- Manual migration: `prisma/migrations/20260823120000_chung_tu_pdf_export_batch_signature_settings/migration.sql`
- `migrate dev` not run (requires live DB / `DATABASE_URL` in env); SQL follows existing MySQL migration patterns from `20260823110000_chung_tu_pdf_template_export`.

## Verification

- `DATABASE_URL=… npx prisma generate` — pass (Prisma Client v7.5.0).

## Commit

- `feat(be): add ChungTuPdfExportBatch and signature settings schema`

## Notes

- Legacy single-file exports keep `storagePath`; batch exports use `documentServiceFolderId` on batch + `documentServiceFileId` on each export row.
- Apply migration on deploy: `npx prisma migrate deploy` (or `migrate dev` locally with DB up).
