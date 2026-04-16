# Transaction Boundary

Transaction nen duoc dat o noi so huu toan bo use case.

## Good Practices

- start the transaction at the service level when multiple writes must succeed together
- keep transactional steps explicit
- separate non-transactional side effects when rollback semantics differ

## Guardrails

- Do not start transactions deep in many nested helpers without coordination.
- Do not let controllers manage transaction lifecycles.
- Keep transaction boundaries visible and intention-revealing.
