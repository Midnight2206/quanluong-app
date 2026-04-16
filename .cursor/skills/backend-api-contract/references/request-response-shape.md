# Request And Response Shape

Contract can ro rang o ca input va output.

## Good Practices

- validate input at the boundary
- shape responses intentionally
- return stable field names and nesting

## Guardrails

- Do not expose raw ORM payloads directly.
- Do not let different endpoints return the same resource in wildly different shapes without a reason.
- Keep response shape easy for clients to consume.
