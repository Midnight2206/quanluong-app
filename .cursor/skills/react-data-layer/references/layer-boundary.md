# Layer Boundary

Tai lieu nay phan biet ro API layer, data layer, va UI layer.

## API Layer

- talks to backend
- shapes request and response payloads
- normalizes transport errors

## Data Layer

- coordinates queries and mutations
- derives view-friendly state
- exposes stable hooks, selectors, or adapters to the UI

## UI Layer

- renders loading, empty, error, and content states
- triggers user actions
- should not understand backend contract details

## Guardrails

- Do not collapse all three layers into one component.
- Do not put backend contract knowledge directly in the UI.
- Keep boundaries readable and intention-revealing.
