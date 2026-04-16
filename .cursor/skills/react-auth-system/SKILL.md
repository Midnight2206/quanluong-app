---
name: react-auth-system
description: Guides building or refactoring a React authentication and access-control system with login/logout flows, current-user bootstrap, route protection, session handling, role or permission guards, and clean integration with shared HTTP client and app state.
---

# Purpose

Dung skill nay khi task lien quan den auth system, session flow, hoac access control trong React app.
Use this skill when the task involves:

- login and logout flows
- current user bootstrap
- protected routes
- role or permission guards
- auth state management
- session expiration handling

# Rules

Skill nay la orchestration layer cho auth va access control.
- Keep transport-level refresh and 401 retry logic in the shared HTTP client layer.
- Keep auth state, current user, and route protection in the auth system layer.
- Treat authentication and authorization as separate concerns.
- Bootstrap current-user state from a trusted source before rendering protected areas.
- Route session expiration through one centralized logout policy.
- Keep permission checks reusable and explicit instead of scattering raw role checks through many components.

# Workflow

Doc reference theo dung lop cua auth system.
1. Read [references/auth-flow.md](references/auth-flow.md) when building login, logout, refresh, and current-user bootstrap.
2. Read [references/session-policy.md](references/session-policy.md) when deciding how to handle expired sessions and redirects.
3. Read [references/access-control.md](references/access-control.md) when adding role-based or permission-based gating.
4. Read [references/route-protection.md](references/route-protection.md) when protecting pages, layouts, or route groups.
5. Reuse [templates/auth-store.js](templates/auth-store.js), [templates/protected-route.jsx](templates/protected-route.jsx), and [templates/permission-check.js](templates/permission-check.js) as the baseline.
6. Use [examples/login-flow.js](examples/login-flow.js) and [examples/guarded-page.jsx](examples/guarded-page.jsx) as integration references.

# Related Skills

Skill nay nen phoi hop voi cac skill sau.
- `react-http-client` for refresh-token and shared session transport behavior
- `react-error-handling` for auth-related fallback and recoverable feedback
- `react-notify-system` for auth-related user messaging when needed
- `react-routing-system` for `PrivateRoute`, `ProtectedRoute`, login redirect, and permission-based route filtering
- `react-project-structure` for placing auth modules under `features/auth/` or app-level guards
- `zustand-app-state` for session and permission state; `tanstack-react-query` for `current-user` and auth-related API hooks
- `next-app-router` when auth middleware or layout boundaries live in Next.js apps

# Adaptation Notes

Phan nay giup auth system khop voi backend va security model cua du an.
- If the backend uses cookie-based auth, avoid storing sensitive tokens in `localStorage`.
- If the app uses permissions, prefer capabilities such as `users.read` or `payroll.manage` over raw role-name checks when possible.
- If bootstrap state is unknown on first load, render a guarded loading state before deciding whether to redirect.
