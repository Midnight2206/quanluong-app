# Service Responsibility

Service layer can co boundary ro rang de business logic khong bi tan man.

## Good Fit

- use-case orchestration
- policy decisions
- coordination across repositories
- side-effect triggering

## Avoid

- raw request parsing
- raw SQL or ORM details
- HTTP response shaping

## Guardrails

- Do not move controller concerns into services.
- Keep repository details behind repository interfaces.
- Name methods by use case, not by technical plumbing.
