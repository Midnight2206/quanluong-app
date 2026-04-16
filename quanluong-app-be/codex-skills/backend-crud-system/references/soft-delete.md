# Soft Delete

Delete trong project nay mac dinh la xoa mem.

## Recommended Model Support

- `deletedAt`
- optional `deletedBy`

## Required Behavior

- delete endpoints mark rows as deleted instead of removing them
- list and detail queries exclude soft-deleted rows by default
- restore behavior may exist later as an explicit use case

## Guardrails

- Do not hard delete by default.
- Do not forget to exclude soft-deleted rows in normal reads.
- Keep audit and delete metadata if the domain needs traceability.
