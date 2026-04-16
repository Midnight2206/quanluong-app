# Query Contract

Pagination, filter, va sort contract nen ro rang va nhat quan.

## Common Concerns

- page or cursor params
- search terms
- filters by field
- sort field and order

## Guardrails

- Keep one contract style per resource.
- Validate query params before use.
- Document omitted or default values clearly in code and handlers.
