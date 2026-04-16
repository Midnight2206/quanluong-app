# Filter Sort Pagination

Listing can co he thong `pagination + filter + sort` chung.

## Recommended Query Keys

- `page`
- `pageSize`
- `sortBy`
- `sortOrder`
- filter fields by explicit allowlist

## Good Practices

- validate all query params
- default to safe sort fields
- restrict sortable and filterable columns to an allowlist

## Guardrails

- Do not pass unchecked field names directly into Prisma order clauses.
- Keep one query contract style across resources.
- Keep query normalization at validation or service boundary, not in controllers.
