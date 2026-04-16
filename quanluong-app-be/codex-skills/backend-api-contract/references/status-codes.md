# Status Codes

Status code rules nen duoc ap dung nhat quan.

## Common Rules

- `200` for successful fetch or update responses
- `201` for successful creation
- `204` for successful deletion without body when appropriate
- `400` for invalid request shape
- `401` for unauthenticated access
- `403` for authenticated but unauthorized access
- `404` for missing resources

## Guardrails

- Do not mix `401` and `403` carelessly.
- Keep error-body mapping stable for similar failures.
- Avoid success responses that hide actual failure semantics.
