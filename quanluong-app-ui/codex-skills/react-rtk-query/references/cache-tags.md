# Cache Tags

Tag system giup query biet khi nao can refetch sau mutation.

## Typical Pattern

1. list query provides list and entity tags
2. detail query provides entity tag by id
3. create, update, or delete mutations invalidate the affected tags

## Guardrails

- Keep tag names stable and domain-specific.
- Avoid invalidating everything if only one entity changed.
- Design tags around real read patterns in the UI.
