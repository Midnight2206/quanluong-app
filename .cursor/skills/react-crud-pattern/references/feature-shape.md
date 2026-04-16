# Feature Shape

Tai lieu nay quy dinh shape co ban cua mot CRUD feature.

## Typical Structure

- `components/`: table, toolbar, form modal, badges, confirm dialog wrappers
- `hooks/`: filter state, permissions, or feature orchestration helpers
- `services/` or `api/`: entity endpoints and transport bindings
- `store/`: entity-specific state if needed beyond the data layer
- `pages/` or route entry: top-level screen composition

## Guardrails

- Keep the entity feature self-contained.
- Do not mix unrelated entities into one shared folder.
- Promote code out of the feature only after real cross-feature reuse.
