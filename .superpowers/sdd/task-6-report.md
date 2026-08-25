# Task 6 report — Prisma status + DS sync

## Delivered
- Updated `ChungTuPdfTemplate` to use `status VARCHAR(20) DEFAULT 'draft'`, removed `isActive`, and indexed `[categoryKey, status]`.
- Added migration `20260825120000_chung_tu_pdf_template_status` to map `isActive=true -> published` and `false -> retired`.
- Added `scripts/sync-chung-tu-pdf-template-status-to-ds.mjs` to retire document-service templates for Prisma rows with `status=retired`, ignoring 409 conflicts.

## Verification
- `npx prisma validate`
- `node --check scripts/sync-chung-tu-pdf-template-status-to-ds.mjs`
