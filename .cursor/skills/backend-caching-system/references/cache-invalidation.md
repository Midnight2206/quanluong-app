# Cache Invalidation

Invalidation la phan quan trong nhat cua caching.

## Common Rules

- after create, invalidate related list caches
- after update, invalidate detail cache and affected list caches
- after soft delete, invalidate normal detail and list caches
- after permission or config changes, invalidate dependent lookup caches

## Preferred Practices

- keep invalidation close to the write flow in services
- invalidate by key pattern only when naming is well controlled
- if invalidation grows large, centralize it in cache helper functions

## Guardrails

- Do not cache writes without a clear invalidation story.
- Do not leave stale list caches after resource mutations.
