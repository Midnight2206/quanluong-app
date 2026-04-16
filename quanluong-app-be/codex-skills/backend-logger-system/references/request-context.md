# Request Context

Request-scoped context giup trace mot request qua nhieu layer.

## Useful Fields

- request id
- user id when available
- route or handler name
- module name
- job id for background work

## Guardrails

- Keep context fields stable and predictable.
- Do not attach large payload blobs by default.
