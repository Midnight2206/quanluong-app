# Logging Boundary

Logging giup quan sat va debug, nhung khong phai noi dat business logic.

## Good Logging Targets

- request start and finish
- important business milestones
- external service failures
- queue job lifecycle
- scheduler lifecycle

## Guardrails

- Do not log every tiny internal step.
- Do not use logs as a substitute for returning structured errors.
- Keep logger calls explicit and intention-revealing.
