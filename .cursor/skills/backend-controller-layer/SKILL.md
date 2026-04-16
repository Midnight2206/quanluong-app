---
name: backend-controller-layer
description: Guides building or refactoring Express controller-layer code in JavaScript so controllers only receive requests, call services, and send HTTP responses, without owning business logic or direct database access.
---

# Purpose

Dung skill nay khi task lien quan den controller layer trong Node.js Express backend.
Use this skill when the task involves:

- Express controllers
- request-to-service flow
- response shaping at the controller boundary
- keeping controller logic thin
- removing business logic from controllers

# Rules

Skill nay khoa chat boundary cua controller layer.
- Controllers only receive `req`, call service methods, and return `res`.
- Controllers must not contain business logic.
- Controllers must not talk directly to the database.
- Controllers must not call repositories directly.
- Controllers may read validated input from middleware and map service output to HTTP responses.
- Controllers should delegate orchestration to the service layer and error handling to centralized middleware.

# Workflow

Doc reference theo dung boundary cua controller.
1. Read [references/controller-responsibility.md](references/controller-responsibility.md) to understand what belongs in controllers.
2. Read [references/request-response-boundary.md](references/request-response-boundary.md) when shaping request input and HTTP output.
3. Read [references/controller-anti-patterns.md](references/controller-anti-patterns.md) when refactoring oversized or logic-heavy controllers.
4. Reuse [templates/controller.js](templates/controller.js) as the baseline.
5. Use [examples/resource-controller.js](examples/resource-controller.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-project-structure` for module placement
- `backend-api-contract` for status code and response contract rules
- `backend-service-layer` for business logic ownership
- `backend-validation-layer` for parsed request data before the controller runs
- `backend-error-handling` for centralized failure serialization

# Adaptation Notes

Phan nay giup controller layer khop voi Express va style cua backend.
- Keep controllers small enough to scan quickly.
- If a controller starts branching on business policy, move that branching to the service layer.
- If a controller repeats the same response envelope pattern, extract a small shared responder helper instead of adding business logic there.
