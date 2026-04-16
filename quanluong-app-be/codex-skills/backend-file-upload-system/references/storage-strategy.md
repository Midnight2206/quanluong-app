# Storage Strategy

Noi luu file can ro rang va phu hop moi truong.

## Typical Choices

- local disk for simple local development
- object storage for scalable production use
- database only for small metadata, not large raw file blobs by default

## Guardrails

- Keep storage adapter isolated from controllers.
- Keep returned metadata normalized.
