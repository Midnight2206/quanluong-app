# Document Service P4 final review fixes

Date: 2026-08-17
Branch: `feat/document-service-p4`

## Fixed

- Return `None` when a template has no table configuration, so fields and document endpoints consistently return `404 NOT_FOUND`.
- Distinguish planner failures with `PaginationError`; map those to `PAGINATION_FAILED` and other renderer `ValueError` failures to `400 BAD_REQUEST`.
- Cover PostgreSQL `templates_name_version_key` integrity failures mapping to `TemplateExistsError`.
- Strengthen metadata round-trip coverage with full dataclass equality.

## Verification

- Targeted regressions: `32 passed`.
- Full suite: `.venv/bin/pytest -v` → `87 passed in 1.39s`.
- IDE diagnostics: no linter errors in changed Python files.
