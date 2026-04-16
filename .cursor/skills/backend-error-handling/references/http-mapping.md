# HTTP Mapping

Error can duoc map sang HTTP contract mot cach nhat quan.

## Common Mapping

- validation -> `400`
- unauthorized -> `401`
- forbidden -> `403`
- not found -> `404`
- conflict -> `409`
- unexpected -> `500`

## Guardrails

- Keep mapping centralized.
- Return stable body fields like `code`, `message`, and optional `details`.
- Avoid exposing internal implementation details.
