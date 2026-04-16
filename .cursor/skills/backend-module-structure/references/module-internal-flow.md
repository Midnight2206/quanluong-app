# Module Internal Flow

Flow ben trong module nen nhat quan de team doc nhanh va tranh boundary drift.

## Preferred Flow

`route -> validator middleware -> controller -> service -> Prisma -> controller response`

## Responsibility Split

- validator: parse and normalize incoming request input
- controller: read validated input, call service, return response
- service: enforce business rules, run transactions, compose domain logic
- Prisma access: stay in the service layer for this project
- mapper: translate domain output only when contract shaping is non-trivial

## Guardrails

- Throw errors upward and let centralized error middleware serialize them.
- Keep HTTP-specific concerns out of services.
- Keep business policy out of validators.
- If one service file becomes too large, split by use case such as `users-create.service.js` and `users-list.service.js`.
