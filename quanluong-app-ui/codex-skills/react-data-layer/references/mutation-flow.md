# Mutation Flow

Mutation flow can duoc dieu phoi o data layer de UI don gian hon.

## Common Responsibilities

- trigger create, update, or delete
- handle optimistic or pessimistic flow
- invalidate or refetch affected queries
- expose pending and success flags

## Good Practices

- keep mutation side effects predictable
- connect mutation results to feedback and refresh behavior
- separate mutation orchestration from low-level form fields

## Guardrails

- Do not let many screens reimplement the same post-mutation logic.
- Do not bury invalidation rules deep in UI components.
- Keep mutation outputs easy for the UI to act on.
