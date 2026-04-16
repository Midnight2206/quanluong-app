# Feature Module

Feature module la don vi chinh de to chuc code theo business domain.

## Typical Feature Shape

- `components/`: feature-only UI pieces
- `hooks/`: feature-only hooks
- `services/` or `api/`: feature transport or endpoint files
- `store/`: slice, selectors, or feature state
- `utils/`: feature-only pure helpers
- `pages/` or `views/`: internal feature compositions when needed

## Recommended Rule

- Keep code close to the domain that owns it.
- Promote code out of a feature only when another feature reuses it.
- Let pages compose features instead of duplicating domain logic.

## Guardrails

- Avoid giant feature folders with no internal structure.
- Avoid creating feature folders for tiny one-off widgets.
- Keep imports directional: shared layers should not depend on feature internals.
