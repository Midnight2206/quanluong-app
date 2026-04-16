# Cursor Pagination

Cursor pagination di chuyen theo moc du lieu thay vi theo chi so trang.

## Typical API Shape

- request: `cursor`, `limit`
- response: `items`, `nextCursor`, optional `prevCursor`, optional `hasMore`

## Good Fit

- activity feeds
- logs
- large lists where inserts and deletes happen often
- mobile or infinite-scroll experiences

## Guardrails

- Treat cursors as opaque values from the backend.
- Do not derive fake page numbers unless the product explicitly needs them.
- Store the next cursor separately from rendered items.
