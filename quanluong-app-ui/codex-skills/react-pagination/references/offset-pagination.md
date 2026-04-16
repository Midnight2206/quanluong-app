# Offset Or Page Pagination

Offset/page pagination phu hop voi bang du lieu va man hinh quan tri co dieu huong ro rang.

## Typical API Shape

- request: `page` and `pageSize`, or `offset` and `limit`
- response: `items`, `total`, and sometimes `totalPages`

## Good Fit

- admin tables
- reports
- screens with sortable columns and filters
- experiences where users expect numbered pages

## Guardrails

- Keep page state, page size, and total metadata synchronized.
- Reset to page 1 when filter changes materially.
- Avoid mixing offset math in many components; keep it in a hook or adapter.
