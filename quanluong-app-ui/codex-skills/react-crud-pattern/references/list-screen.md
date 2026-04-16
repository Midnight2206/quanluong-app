# List Screen

List screen la diem vao chinh cua nhieu CRUD feature.

## Typical Pieces

- title and actions
- filters or search
- table or list view
- pagination controls
- loading, empty, error states

## Good Practices

- keep list state orchestration near the container
- use stable columns and action slots
- separate row actions from page-level actions

## Guardrails

- Do not bury pagination and filters inside row components.
- Do not mix create or edit form logic directly into the table body.
- Keep the list screen predictable across entities.
