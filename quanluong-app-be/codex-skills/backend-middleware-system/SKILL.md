---
name: backend-middleware-system
description: Build or refactor a Node.js Express middleware system with clear middleware ordering, request context enrichment, auth and permission guards, validation boundaries, and centralized error delegation.
---

# Purpose

Dung skill nay khi task lien quan den middleware system trong Node.js Express backend.
Use this skill when the task involves:

- Express middleware ordering
- auth middleware
- permission middleware
- validation middleware
- request context middleware
- centralized error delegation

# Rules

Skill nay chuan hoa middleware theo dung boundary cua Express app.
- Use middleware for cross-cutting request concerns, not business use cases.
- Keep middleware small, single-purpose, and composable.
- Run validation before controllers.
- Run authentication before authorization checks.
- Forward all failures to centralized error middleware with `next(error)`.
- Do not hide business orchestration inside middleware.

# Workflow

Doc reference theo dung loai middleware.
1. Read [references/middleware-order.md](references/middleware-order.md) when assembling the request pipeline.
2. Read [references/request-context.md](references/request-context.md) when attaching request id, auth context, or tracing data.
3. Read [references/guard-middleware.md](references/guard-middleware.md) when implementing auth or permission checks.
4. Read [references/middleware-anti-patterns.md](references/middleware-anti-patterns.md) when refactoring oversized or logic-heavy middleware.
5. Reuse [templates/request-context.js](templates/request-context.js), [templates/guard-middleware.js](templates/guard-middleware.js), and [templates/apply-middlewares.js](templates/apply-middlewares.js) as the baseline.
6. Use [examples/route-pipeline.js](examples/route-pipeline.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-auth-system` for auth and permission middleware content
- `backend-validation-layer` for request parsing and schema checks
- `backend-error-handling` for centralized error serialization
- `backend-controller-layer` for keeping controllers thin after middleware completes

# Adaptation Notes

Phan nay giup middleware system giu app de debug va de mo rong.
- Prefer explicit middleware order over hidden side effects.
- Keep shared request context fields stable across the app.
- Use middleware for boundary concerns only, then hand off to controllers and services.
