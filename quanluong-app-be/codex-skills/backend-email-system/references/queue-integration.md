# Queue Integration

Gui email la use case rat hop de dua vao queue.

## Prefer Queue When

- the user does not need the mail result immediately
- one action sends many emails
- email rendering or provider latency may slow the request
- retries are important

## Typical Flow

- service accepts business action
- service enqueues email job
- worker renders and sends email
- failures are retried or logged explicitly

## Guardrails

- Keep queue payloads minimal, such as recipient, template key, and template data.
- Avoid passing large pre-rendered HTML in job payloads unless there is a strong reason.
