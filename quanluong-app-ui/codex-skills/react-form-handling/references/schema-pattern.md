# Schema Pattern

Schema nen la nguon su that cho validate va mapping du lieu dau vao.

## Recommended Shape

1. declare one Zod schema per form intent
2. derive defaults near the schema or in a small helper
3. normalize submit payload after schema parsing when needed

## Good Practices

- use meaningful messages in schema rules
- use `z.coerce` when input values need normalization from strings
- separate create and update schemas when the requirements differ materially

## Guardrails

- Do not duplicate the same validation rules in many components.
- Keep schema files close to the feature that owns the form.
- Avoid overloading one giant schema for unrelated flows.
