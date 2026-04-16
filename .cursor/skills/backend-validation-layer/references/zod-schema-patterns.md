# Zod Schema Patterns

Project nay dung `Zod` lam thu vien validate req mac dinh.

## Good Practices

- define one schema per request intent
- keep create, patch, put, query, and params schemas separate
- use `z.coerce` when parsing numbers, booleans, or dates from request input
- keep field names aligned with validated DTO output

## Common Targets

- `bodySchema`
- `querySchema`
- `paramsSchema`

## Guardrails

- Do not mix many schema libraries in the same backend without a strong reason.
- Do not overload one giant schema for many unrelated routes.
- Keep Zod schemas close to the module or route they protect.
