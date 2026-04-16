# Container Boundaries

Moi container nen co trach nhiem runtime ro rang.

## Preferred Split

- `app`: Express HTTP server
- `db`: MariaDB
- `redis`: Redis for queue, cache, or session support
- optional `worker`: BullMQ worker process
- optional `scheduler`: cron-like scheduler process

## Guardrails

- Do not run MariaDB inside the app container.
- Do not mix unrelated long-running processes in one container unless the deployment model truly requires it.
- Reuse the same app image for `app`, `worker`, and `scheduler` when only the startup command differs.
