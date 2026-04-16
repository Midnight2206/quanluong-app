# Compose Setup

`docker-compose.yml` can la noi mo ta local stack cho team.

## Typical Services

- `app`
- `db`
- `redis`
- optional `worker`
- optional `scheduler`

## Preferred Rules

- define named volumes for persistent database data
- use an internal Docker network by default
- pass runtime config through environment variables
- add healthchecks for dependencies that need readiness checks
- keep service names stable because app env vars often reference them

## Guardrails

- Do not rely only on `depends_on` as if it guaranteed full readiness.
- Keep compose files readable and purpose-specific.
- If the stack has separate dev and prod needs, keep them as explicit variants instead of one overloaded file.
