# API Module Shape

API layer nen duoc to chuc theo domain hoac resource ro rang.

## Recommended Structure

- one file per resource such as `usersApi`, `rolesApi`, `payrollApi`
- grouped functions by intent: list, detail, create, update, delete

## Good Practices

- keep exported functions named by domain action
- keep route paths close to the resource module
- keep modules small enough to scan quickly

## Guardrails

- Do not dump unrelated endpoints into one shared file.
- Do not leak raw endpoint strings into components.
- Keep API modules transport-oriented, not UI-aware.
