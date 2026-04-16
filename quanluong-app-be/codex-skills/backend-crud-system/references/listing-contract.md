# Listing Contract

Tat ca list endpoint nen co mot contract chung de frontend de tieu thu.

## Recommended Response Shape

- `items`
- `meta.page`
- `meta.pageSize`
- `meta.total`
- optional `meta.sort`
- optional `meta.filters`

## Good Practices

- keep list contract stable across resources
- keep metadata under `meta`
- return soft-delete filtered data by default

## Guardrails

- Do not make each resource invent a different list shape.
- Do not mix pagination metadata into each item.
- Keep list response easy for table and filter UIs to consume.
