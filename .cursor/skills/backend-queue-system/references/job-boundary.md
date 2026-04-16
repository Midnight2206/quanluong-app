# Job Boundary

Job payload nen nho, ro rang, va an toan.

## Good Practices

- pass ids and compact metadata
- let workers load fresh DB state when needed
- keep payloads serializable and version-tolerant

## Avoid

- passing huge nested objects
- passing secrets unless absolutely necessary
- coupling job payload to transient controller state

## Guardrails

- Prefer stable identifiers over large payload copies.
- Keep payloads explicit by job intent.
- Avoid leaking sensitive fields into queue storage.
