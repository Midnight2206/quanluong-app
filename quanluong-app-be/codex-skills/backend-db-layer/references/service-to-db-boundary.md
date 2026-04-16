# Service To DB Boundary

Trong project nay, service lam viec truc tiep voi Prisma Client.

## Required Rules

- services may call Prisma directly
- controllers must not call Prisma directly
- Prisma access should stay in the service or nearby domain-use-case layer

## Good Practices

- keep Prisma queries close to the use case that owns them
- keep business rules around queries in the same service flow
- keep repeated query fragments small and intention-revealing if extracted

## Guardrails

- Do not call Prisma from controllers.
- Do not bypass service rules when reading or writing data.
- Do not add a repository layer by default unless the project later has a strong reason.
