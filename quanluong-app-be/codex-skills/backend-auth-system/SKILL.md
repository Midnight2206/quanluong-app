---
name: backend-auth-system
description: Build or refactor a Node.js Express authentication and authorization system using JWT, session, and httpOnly cookies, with permission-aware route protection and a current-user payload shape aligned with the frontend auth system.
---

# Purpose

Dung skill nay khi task lien quan den auth va access control o backend.
Use this skill when the task involves:

- login, logout, refresh, or current-user endpoints
- JWT token handling
- server session handling
- httpOnly cookie auth
- route permission middleware
- permission payloads for the frontend

# Rules

Skill nay khoa chat auth stack va access-control policy cua backend.
- Use both `JWT` and `session` where each one has a clear role in the auth flow.
- Use `httpOnly` cookies for security-sensitive session or token transport.
- Keep authentication and authorization separate.
- Protect backend routes with reusable auth and permission middleware.
- Route access control must be enforced on the backend even if the frontend also hides routes.
- Return a stable `user + permissions` shape that the frontend can consume directly.
- Keep auth failures generic enough to avoid leaking sensitive information.

# Workflow

Doc reference theo dung lop auth cua backend.
1. Read [references/auth-flow.md](references/auth-flow.md) when building login, logout, refresh, and current-user behavior.
2. Read [references/jwt-session-cookies.md](references/jwt-session-cookies.md) when deciding how JWT, session, and httpOnly cookies work together.
3. Read [references/permission-route-guard.md](references/permission-route-guard.md) when enforcing permission checks on routes and middleware.
4. Read [references/frontend-alignment.md](references/frontend-alignment.md) when shaping user and permission payloads for the existing frontend auth system.
5. Reuse [templates/auth-service.js](templates/auth-service.js), [templates/auth-middleware.js](templates/auth-middleware.js), and [templates/permission-middleware.js](templates/permission-middleware.js) as the baseline.
6. Use [examples/current-user-response.js](examples/current-user-response.js) and [examples/protected-route.js](examples/protected-route.js) as references.

# Related Skills

Skill nay thuong di cung:
- `backend-db-layer` for MariaDB and Prisma-backed auth persistence
- `backend-service-layer` for auth business logic
- `backend-controller-layer` for thin auth endpoints
- `backend-error-handling` for centralized auth failure mapping
- `backend-response-system` for unified auth responses
- frontend `react-auth-system` and `react-routing-system` for matching client behavior

# Adaptation Notes

Phan nay giup auth system BE khop voi app frontend da co.
- Keep the current-user response stable so the frontend can populate auth state without extra mapping.
- Prefer permissions such as `users.read` or `payroll.manage` over only role-name checks when the app grows.
- If sessions or refresh flows expire, let backend auth endpoints and middleware return predictable auth failures for the frontend to handle cleanly.
