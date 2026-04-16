# Query Params

Filter, sort, search, va pagination params nen duoc xu ly o API layer.

## Common Concerns

- page or cursor params
- search terms
- filter collections
- sort field and order

## Good Practices

- omit empty params when the backend expects sparse query strings
- keep param naming aligned with backend contract
- use small helpers for repetitive param assembly

## Guardrails

- Do not build query strings directly in components.
- Do not scatter pagination param naming across the app.
- Keep param generation readable and testable.
