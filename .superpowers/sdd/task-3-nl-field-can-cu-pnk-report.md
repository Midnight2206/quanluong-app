# Task 3 Report — NL_FIELD Import

**Status:** DONE  
**Commit:** pending

## Implemented

- Added `services/document-service/app/import/field_named_ranges.py` to centralize `FIELD_` and `NL_FIELD_` prefix parsing.
- Updated `template_importer.py` to import both prefixes, validate the derived `field_name`, and keep the original `named_range` on `FieldMeta`.
- Updated `static_cells.py` to skip both `FIELD_*` and `NL_FIELD_*` cells when collecting static content.
- Persisted `FieldMeta.named_range` through existing JSON metadata so `/v1/templates/{id}/fields` can return the full named range without a DB migration.
- Added importer coverage for `NL_FIELD_can_cu_pnk` parsing and merged-cell static-cell skipping; updated the fields API test; added one README line for `NL_FIELD_*`.

## Tests

```bash
cd services/document-service
python -m pytest tests/test_template_importer.py tests/test_templates_http.py -q
```

Result: `43 passed`

## Concerns

Non-blocking: `app/main.py`, `app/template/metadata.py`, and `README.md` already had unrelated local hunks in the working tree, so Task 3 must be committed with careful partial staging to avoid bundling them.
