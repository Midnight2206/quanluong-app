# Cache Safety

Caching co the gay stale data hoac leak data neu policy khong ro.

## Preferred Practices

- fail open to DB when cache is unavailable
- serialize cached payloads safely and predictably
- cache only the data shape actually needed
- separate tenant-aware or user-scoped keys carefully

## Guardrails

- Do not cache auth secrets, raw tokens, or password-related material.
- Do not share user-specific cached data across tenants or sessions.
- Do not let cache errors crash the request path if DB fallback is still possible.
