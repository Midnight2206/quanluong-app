# HTTP Semantics

HTTP code phai hop ly va phan anh dung loai ket qua.

## Common Rules

- `200` for successful reads and updates with body
- `201` for successful creation
- `204` for successful deletion without body
- `400` for invalid input
- `401` for unauthenticated
- `403` for unauthorized
- `404` for not found
- `409` for conflict
- `500` for unexpected server failure

## Guardrails

- Do not always return `200` with an embedded failure flag.
- Keep status codes aligned with actual outcome semantics.
- Let the central error layer decide status for thrown application errors.
