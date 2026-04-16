---
name: react-routing-system
description: Build or refactor React routing with explicit public routes, PrivateRoute, ProtectedRoute, post-login redirect to the originally requested page, route filtering by permission, and maintainable route configuration for authenticated apps.
---

# Purpose

Dung skill nay khi task lien quan den router, route guard, redirect sau login, hoac route filtering theo permission.
Use this skill when the task involves:

- React Router structure
- public, private, and protected routes
- redirect to login when unauthenticated
- return user to the intended route after login
- hide routes or pages when the user lacks permission

# Rules

Skill nay tach ro route access theo tung muc do.
- Use public routes for screens accessible without authentication.
- Use `PrivateRoute` for routes that only require a logged-in session.
- Use `ProtectedRoute` for routes that require both authentication and specific permission checks.
- If an unauthenticated user tries to open a private or protected route, redirect to the login page and preserve the intended destination.
- After successful login, return the user to the originally requested route if one exists.
- Hide routes, menu items, and page entry points the user cannot access by permission.
- Keep route guard logic reusable instead of duplicating checks in each page.

# Workflow

Doc reference theo dung bai toan routing.
1. Read [references/route-types.md](references/route-types.md) to choose between public, private, and protected routes.
2. Read [references/post-login-redirect.md](references/post-login-redirect.md) when implementing the flow that returns users to the route they originally wanted.
3. Read [references/permission-filtering.md](references/permission-filtering.md) when hiding routes, navigation items, or route groups by permission.
4. Read [references/route-configuration.md](references/route-configuration.md) when structuring the route map or route objects.
5. Reuse [templates/private-route.jsx](templates/private-route.jsx), [templates/protected-route.jsx](templates/protected-route.jsx), and [templates/filter-routes.js](templates/filter-routes.js) as the baseline.
6. Use [examples/login-redirect.jsx](examples/login-redirect.jsx) and [examples/nav-filter.js](examples/nav-filter.js) as integration references.

# Related Skills

Skill nay thuong di cung:
- `react-auth-system` for auth state, current-user bootstrap, and permission helpers
- `react-project-structure` for route and page placement
- `react-error-handling` for denied or broken route fallback
- `react-loading-empty-states` for auth-unknown loading during route bootstrap

# Adaptation Notes

Phan nay giup routing system khop voi UX va security model cua du an.
- If auth bootstrap is still unknown, show a guarded loading state before redirecting.
- Prefer permission-based route metadata over raw role checks scattered in route definitions.
- Route filtering should affect both router config and visible navigation when the same access rules apply.
