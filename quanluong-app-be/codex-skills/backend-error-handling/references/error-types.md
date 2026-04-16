# Error Types

Expected failure nen duoc the hien bang error type ro rang.

## Common Categories

- validation error
- unauthorized error
- forbidden error
- not found error
- conflict error

## Guardrails

- Do not throw generic `Error` everywhere for expected failures.
- Keep machine-readable codes stable.
- Name error types by business meaning when possible.
