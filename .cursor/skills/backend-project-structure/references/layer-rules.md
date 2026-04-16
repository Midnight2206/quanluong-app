# Layer Rules

Mỗi layer trong backend cần có boundary rõ ràng.

## Route Layer

- declare Express routes
- attach middleware and validators
- delegate handling to controllers

## Controller Or Route Layer

- receive request
- parse validated input
- call service
- map output to HTTP response
- never call repositories or database clients directly

## Service Layer

- own business rules
- coordinate Prisma access, external providers, and transactions
- decide transactions and side effects

## Guardrails

- Do not put business logic in Express route files.
- Do not let controllers own business orchestration.
- Do not let controllers call Prisma or database clients directly.
- Keep service methods intention-revealing.
