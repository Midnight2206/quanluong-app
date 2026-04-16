# State Architecture

Tai lieu nay dung de xac dinh state nao nen o global store va state nao nen o local component.

## Prefer Redux For

- auth session summaries used across many features
- shared filters reused across routes
- entities or flags that many screens need
- workflows that benefit from traceable state transitions

## Prefer Local Or Feature State For

- modal open state limited to one page
- uncontrolled form input drafts
- hover, focus, or transient animation state

## Guardrails

- Do not mirror server cache in Redux if `react-rtk-query` already owns that data.
- Do not store derived values that selectors can compute cheaply.
- Organize state by feature domain before organizing by technical type.
