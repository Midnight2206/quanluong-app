# Service Composition

Service co the phoi hop voi nhieu dependency nhung van phai de hieu.

## Common Collaborators

- repositories
- validators or policy helpers
- external clients
- event publishers

## Guardrails

- Avoid circular service dependencies.
- Split services when one class or module owns too many unrelated concerns.
- Keep collaborator roles explicit in method flow.
