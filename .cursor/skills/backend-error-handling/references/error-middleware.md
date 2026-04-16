# Error Middleware

Error middleware la lop cuoi de serialize loi ra HTTP response.

## Responsibilities

- inspect application error types
- choose status code
- serialize safe error payload
- log unexpected failures

## Guardrails

- Do not duplicate error serialization in every controller.
- Keep logging and response serialization readable.
- Make unexpected errors obvious to operators but safe for clients.
