# Env And Secrets

Docker chi nen nhan secret qua env hoac secret manager, khong ghi truc tiep vao image.

## Preferred Practices

- keep `.env.example` in the repo, not real secrets
- read runtime configuration from environment variables
- use compose env injection for local development
- keep cookie, JWT, session, DB, and Redis config externalized

## Guardrails

- Do not commit production secrets.
- Do not scatter env keys across many unrelated files without documentation.
- Keep variable names explicit, stable, and aligned with app config.
