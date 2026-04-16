# Form Component Extraction

Form la noi rat de bi phong to, nen can rule tach ro rang.

## Extract When

- the form file approaches or exceeds roughly 500 lines
- a section such as address, payroll settings, or account permissions has its own rendering logic
- the same field group appears in two or more screens
- step-based or tab-based forms start mixing too many concerns

## Preferred Extraction Order

1. extract field sections inside the same feature
2. extract repeated field adapters or wrappers
3. extract shared form primitives only after cross-feature reuse

## Guardrails

- Keep `useForm` ownership in the highest useful form container.
- Pass only the minimum props needed to child sections.
- Prefer feature-local extraction before moving code to shared global folders.
