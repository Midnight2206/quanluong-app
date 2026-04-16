# Env Loading

Moi truong can duoc nap nhat quan khi app khoi dong.

## Preferred Practices

- load `.env` near startup for local development
- allow deployment environment variables to override local defaults
- keep `.env.example` documented, not real secrets

## Guardrails

- Do not depend on hidden undeclared env keys.
- Keep startup config loading deterministic.
