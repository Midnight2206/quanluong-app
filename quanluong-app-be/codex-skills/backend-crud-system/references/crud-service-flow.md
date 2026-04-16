# CRUD Service Flow

CRUD service can co flow ro rang de frontend de du doan.

## Typical Responsibilities

- list with normalized query params
- detail lookup excluding soft-deleted rows
- create with validation-safe input
- patch update with partial semantics
- put update with full semantics
- soft delete mutation

## Guardrails

- Keep CRUD branching in services, not controllers.
- Use Prisma consistently for read and write flow.
- Use transactions when one CRUD action touches many tables or audit rows.
