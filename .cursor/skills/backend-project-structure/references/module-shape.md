# Module Shape

Mot domain module nen co shape de scan va mo rong de dang.

## Typical Pieces

- route file
- controller or route handlers
- service
- validator or schema
- mapper if contract translation is needed
- optional Prisma helpers only if a domain truly needs local query utilities

## Guardrails

- Keep module exports explicit.
- Keep each file responsibility-focused.
- Avoid giant god-modules for one domain.
