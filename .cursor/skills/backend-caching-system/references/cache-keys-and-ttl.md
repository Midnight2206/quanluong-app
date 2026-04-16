# Cache Keys And TTL

Key naming va TTL tot se giup cache de quan ly va de invalidate.

## Key Style

Use namespaced keys such as:

- `users:list:page=1:limit=20:sort=createdAt_desc`
- `users:detail:id=42`
- `permissions:role=admin`

## TTL Guidance

- short TTL for volatile lists
- medium TTL for moderately stable lookups
- longer TTL for static reference data

## Guardrails

- Do not use opaque random key names for business data caches.
- Do not set no-expiry by default.
- Include enough context in the key to avoid collisions across filters or tenants.
