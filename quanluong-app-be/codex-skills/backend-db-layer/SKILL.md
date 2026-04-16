---
name: backend-db-layer
description: Build or refactor a Node.js Express backend database layer using MariaDB and Prisma 7 with schema-first modeling, `prisma.config.ts`, Prisma Client adapter setup, explicit migrations, transaction-safe complex operations, direct service access, and strong SQL injection prevention.
---

# Purpose

Dung skill nay khi task lien quan den DB layer cua backend voi `MariaDB + Prisma`.
Use this skill when the task involves:

- Prisma schema design
- MariaDB data modeling
- migrations
- Prisma client queries
- transaction-safe database workflows
- SQL injection prevention

# Rules

Skill nay khoa chat stack va boundary cua DB layer cho project nay.
- Default database stack is `MariaDB + Prisma`.
- All database structures must be defined through `prisma/schema.prisma`.
- In Prisma 7, datasource URLs for Migrate live in `prisma.config.ts`, not in `schema.prisma`.
- Database changes must go through clear Prisma migrations.
- Services work directly with Prisma Client for database access.
- Runtime Prisma Client must be instantiated with a MariaDB adapter in application code.
- Complex database workflows must use transactions.
- Never build raw SQL from untrusted string concatenation.
- Prefer Prisma query APIs over raw SQL whenever possible.

# Workflow

Doc reference theo dung bai toan DB.
1. Read [references/prisma-schema.md](references/prisma-schema.md) when creating or updating models.
2. Read [references/migration-rules.md](references/migration-rules.md) when changing database structure.
3. Read [references/service-to-db-boundary.md](references/service-to-db-boundary.md) when deciding how services should access Prisma.
4. Read [references/transactions.md](references/transactions.md) when the use case spans many DB writes or consistency-sensitive steps.
5. Read [references/sql-injection-safety.md](references/sql-injection-safety.md) when queries become dynamic or complex.
6. Reuse [templates/prisma-config.ts](templates/prisma-config.ts), [templates/prisma-service.js](templates/prisma-service.js), [templates/prisma-client.js](templates/prisma-client.js), and [templates/transaction-flow.js](templates/transaction-flow.js) as the baseline.
7. Use [examples/create-user-service.js](examples/create-user-service.js) and [examples/prisma-schema.prisma](examples/prisma-schema.prisma) as references.

# Related Skills

Skill nay thuong di cung:
- `backend-project-structure` for folder placement
- `backend-service-layer` for business orchestration around Prisma access
- `backend-validation-layer` for trusted DTOs before DB writes
- `backend-error-handling` for DB failure mapping
- `backend-api-contract` for public response shape after DB access

# Adaptation Notes

Phan nay giup DB layer khop voi team workflow.
- Keep migrations small, reviewable, and committed to the repository for team sync.
- For this JavaScript backend, keep Prisma on v7 with `prisma.config.ts` plus a MariaDB adapter; do not rely on legacy datasource URLs inside the schema.
- If one service use case has many DB steps that must succeed together, wrap them in one Prisma transaction.
- If a query becomes too custom for Prisma's fluent API, use raw SQL only through safe Prisma mechanisms and parameterization.
