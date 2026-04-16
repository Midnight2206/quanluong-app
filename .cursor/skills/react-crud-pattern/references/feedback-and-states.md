# Feedback And States

CRUD flow can mot cach hien thi state va feedback thong nhat.

## Expected UX Layers

- loading and empty states for the list
- inline validation for forms
- toast feedback for successful or recoverable mutations
- fallback or error UI for blocked sections when needed
- optional persistent notification only for important workflow events

## Good Practices

- preserve table layout during background refresh
- distinguish empty data from failed requests
- keep success and failure feedback short and actionable

## Guardrails

- Do not show duplicate feedback in toast, fallback, and inline UI at the same time.
- Do not treat a successful empty response as an error.
- Keep feedback rules consistent across entities.
