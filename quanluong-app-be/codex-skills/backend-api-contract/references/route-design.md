# Route Design

Route design nen nhat quan va de doan.

## Good Practices

- use resource-oriented paths
- keep nested routes meaningful, not arbitrary
- keep domain actions explicit when they are not plain CRUD

## Guardrails

- Do not invent many route styles for similar resources.
- Avoid leaking database or implementation terms into public paths.
- Keep route naming stable over time.
