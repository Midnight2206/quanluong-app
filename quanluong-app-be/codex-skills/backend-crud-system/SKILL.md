---
name: backend-crud-system
description: Build or refactor backend CRUD features in Node.js Express with unified listing contracts, shared pagination-filter-sort behavior, soft delete policy, PATCH for partial updates, PUT for full replacement, and consistent Prisma-backed service orchestration.
---

# Purpose

Dung skill nay khi task lien quan den CRUD system o backend.
Use this skill when the task involves:

- CRUD endpoints
- list endpoints with pagination, filter, and sort
- create, update, delete backend flows
- soft delete rules
- PATCH versus PUT semantics

# Rules

Skill nay chuan hoa CRUD policy cho toan bo backend.
- All list endpoints should follow one consistent pagination, filter, and sort contract style.
- Soft delete is the default delete policy.
- Use `PATCH` for partial updates.
- Use `PUT` for full resource replacement.
- Keep CRUD route semantics predictable across all resources.
- Keep business logic in services and Prisma access inside services.
- Keep success and error responses aligned with the shared response system.

# Workflow

Doc theo dung loai CRUD operation.
1. Read [references/listing-contract.md](references/listing-contract.md) when designing list endpoints.
2. Read [references/filter-sort-pagination.md](references/filter-sort-pagination.md) when handling shared list query params.
3. Read [references/update-semantics.md](references/update-semantics.md) when deciding between `PATCH` and `PUT`.
4. Read [references/soft-delete.md](references/soft-delete.md) when implementing delete behavior.
5. Read [references/crud-service-flow.md](references/crud-service-flow.md) when wiring Prisma-backed CRUD services.
6. Reuse [templates/list-handler.js](templates/list-handler.js), [templates/soft-delete-service.js](templates/soft-delete-service.js), and [templates/update-service.js](templates/update-service.js) as the baseline.
7. Use [examples/users-crud-routes.js](examples/users-crud-routes.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-api-contract` for route and status semantics
- `backend-response-system` for unified response envelopes
- `backend-validation-layer` for query and payload validation
- `backend-service-layer` for business orchestration
- `backend-db-layer` for Prisma and MariaDB access

# Adaptation Notes

Phan nay giup CRUD system khop voi domain va team convention.
- Keep the same list query keys across resources unless the backend has a very strong reason to differ.
- Soft-deleted rows should be excluded from normal list and detail reads by default.
- If a resource truly needs hard delete, make that an explicit exception, not the default pattern.
