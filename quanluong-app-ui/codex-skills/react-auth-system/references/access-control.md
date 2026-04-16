# Access Control

Access control la lop quy dinh user duoc lam gi sau khi da xac thuc.

## Common Models

- role-based checks such as `admin`, `manager`, `staff`
- permission-based checks such as `users.read`, `users.update`

## Preferred Approach

- expose reusable helper functions or hooks
- keep permission checks declarative near guards and feature entry points
- use the smallest permission needed for the action

## Guardrails

- Do not scatter raw string comparisons everywhere.
- Do not mix session existence with permission logic.
- Prefer capability checks over giant nested role trees when the app grows.
