# Request Context

Request context giup middleware, controller, va logger dung chung thong tin can thiet.

## Common Fields

- request id
- authenticated user id
- permissions
- correlation or trace metadata

## Guardrails

- Keep request context small and stable.
- Do not attach large domain payloads to `req`.
- Avoid mutating request context unpredictably across many middleware layers.
