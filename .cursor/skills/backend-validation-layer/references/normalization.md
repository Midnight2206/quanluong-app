# Normalization

Normalization giup service nhan duoc du lieu sach va on dinh.

## Common Cases

- trim strings
- coerce numbers or booleans
- normalize empty strings to null when appropriate
- map external field naming to internal DTO naming

## Guardrails

- Keep normalization deterministic.
- Do not hide business-side defaults that should live in services.
- Keep normalization close to schema parsing.
