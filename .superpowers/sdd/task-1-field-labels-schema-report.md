# Task 1 Report: Schema — fieldLabelsJson on ChungTuPdfTemplate

**Status:** DONE

## Commit

- `ef90336` — `feat(chung-tu): add fieldLabelsJson on PDF templates`

## Schema

`ChungTuPdfTemplate.fieldLabelsJson` (`Json?`) — per-template field label map `{ [fieldKey]: string }`.

## Migration

File: `quanluong-app-be/prisma/migrations/20260905180000_chung_tu_pdf_template_field_labels_json/migration.sql`

```sql
ALTER TABLE `ChungTuPdfTemplate` ADD COLUMN `fieldLabelsJson` JSON NULL;
```

### How applied

`migrate dev` blocked by pre-existing drift on `20260718100000_kitchen_receipt_daily_unique_line_source`. Workaround:

1. Schema updated per plan
2. Migration SQL authored manually
3. `prisma db execute --file ...` in Docker `quanluong-app-be`
4. `prisma migrate resolve --applied 20260905180000_chung_tu_pdf_template_field_labels_json`
5. `prisma generate` — `ChungTuPdfTemplateScalarFieldEnum.fieldLabelsJson` present

`migrate diff --from-config-datasource --to-schema` shows no pending change for `ChungTuPdfTemplate`.

## Concerns

- Pre-existing migration drift still blocks `migrate dev`; not introduced here.
- Existing templates have NULL `fieldLabelsJson` until Task 4–5; PDF export unchanged until Task 2–3 wire labels.
