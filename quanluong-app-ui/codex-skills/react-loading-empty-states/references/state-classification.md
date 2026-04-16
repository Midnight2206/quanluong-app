# State Classification

Tai lieu nay giup phan biet ro cac state du lieu trong UI.

## Initial Loading

- first request is in flight
- no usable data is available yet
- the UI should reserve space or show a stable placeholder

## Background Refresh

- the screen already has usable data
- a refetch or revalidation is happening
- the UI should avoid clearing existing content

## Empty State

- request completed successfully
- data is valid but empty
- the UI should explain what "empty" means in this context

## Error State

- request or render failed
- the screen should route to error handling or fallback UI policy

## Guardrails

- Do not treat empty arrays as errors.
- Do not replace existing content with a full spinner during background refresh.
- Keep one state owner for each section to avoid contradictory rendering.
