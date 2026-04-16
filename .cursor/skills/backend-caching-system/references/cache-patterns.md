# Cache Patterns

Khong phai moi bai toan cache deu dung chung mot pattern.

## Preferred Default

`cache-aside`

Flow:
- read cache by key
- if hit, return cached value
- if miss, query DB
- store result in cache with TTL
- return result

## Other Patterns

- write-through: update cache together with writes when policy is simple and controlled
- refresh-ahead: refresh hot keys before expiration through queue or schedule

## Guardrails

- Default to cache-aside unless there is a strong reason not to.
- Keep fallback to DB explicit.
- Do not hide complex cache refresh logic inside generic utility code without clear naming.
