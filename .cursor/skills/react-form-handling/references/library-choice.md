# Library Choice

Tai lieu nay chot stack mac dinh cho form handling trong du an nay.

## Default Choice

- form state: `react-hook-form`
- validation schema: `zod`

## Why This Pair

- `react-hook-form` is lightweight, performant, and integrates well with controlled or uncontrolled inputs.
- `zod` gives schema-based validation plus strong type inference.
- `@hookform/resolvers` supports `zodResolver`, so form state and schema validation stay cleanly connected.

## Guardrails

- Do not mix multiple validation libraries in the same project without a strong reason.
- Prefer schema-first validation over scattered inline field rules for non-trivial forms.
- Keep the choice consistent across features unless legacy code forces otherwise.
