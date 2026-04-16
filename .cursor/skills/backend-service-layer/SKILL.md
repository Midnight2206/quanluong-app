---
name: backend-service-layer
description: Guides building or refactoring backend service-layer logic with clear business orchestration, Prisma coordination, transaction ownership, side-effect management, and framework-independent domain behavior.
---

# Purpose

Dung skill nay khi task lien quan den business logic va orchestration o backend.
Use this skill when the task involves:

- service methods
- business rules
- Prisma coordination
- side effects and transactions
- domain orchestration

# Rules

Skill nay la noi so huu business logic cua backend.
- Keep business rules in services, not controllers.
- In this project, services may work directly with Prisma for database access.
- Let services coordinate Prisma queries, external providers, and transactions.
- Keep service methods named by business intent.
- Keep services framework-light and easy to test.
- Do not let controllers or middleware own business decisions.

# Workflow

Doc reference theo dung loai orchestration.
1. Read [references/service-responsibility.md](references/service-responsibility.md) when deciding what belongs in a service.
2. Read [references/transaction-boundary.md](references/transaction-boundary.md) when multiple writes or side effects need coordination.
3. Read [references/service-composition.md](references/service-composition.md) when one service needs to work with multiple collaborators.
4. Reuse [templates/service-method.js](templates/service-method.js) as the baseline.
5. Use [examples/domain-service.js](examples/domain-service.js) as a reference.

# Adaptation Notes

Phan nay giup service layer khop voi domain va infra hien tai.
- Keep transaction orchestration near the use case that needs it.
- If the project uses MariaDB with Prisma, keep Prisma access in services by default.
- If a service becomes too large, split by subdomain or use-case intent.
- Keep I/O details at the edges and business branching in the center.
