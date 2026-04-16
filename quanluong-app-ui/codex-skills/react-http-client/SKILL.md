---
name: react-http-client
description: Build or update a shared React API client with axios interceptors, cookie-based auth, refresh-token retry queue, centralized 401 handling, session logout flow, and service-layer usage outside components.
---

# Purpose

Dung skill nay khi bai toan lien quan den shared HTTP client cho React app.
Use this skill when the task involves a shared HTTP client for a React app:

- axios instance or interceptor setup
- cookie-based auth with `/auth/refresh`
- retrying requests after a 401
- centralized logout or session expiration handling
- moving API calls out of components into service modules

# Rules

Dưới đây là các nguyên tắc cốt lõi để giữ API layer nhất quán trong app.
- Reuse one shared client module instead of calling `axios` directly in components.
- Keep refresh-token logic inside the HTTP layer, not inside pages or hooks.
- Handle 401 responses centrally with an interceptor.
- Use `withCredentials: true` when the backend relies on http-only cookies.
- Keep service functions thin; they should delegate transport concerns to the shared client.

# Workflow

Đọc reference theo đúng nhu cầu thay vì nạp toàn bộ context một lúc.
1. Read [references/request-flow.md](references/request-flow.md) for the request lifecycle.
2. Read [references/refresh-token.md](references/refresh-token.md) if the task mentions 401, refresh, retry, or queueing.
3. Read [references/session-handling.md](references/session-handling.md) if the task affects logout, redirect, or cross-tab session sync.
4. Read [references/auth-flow.md](references/auth-flow.md) when the task touches login or cookie-based auth assumptions.
5. Reuse [templates/httpClient.js](templates/httpClient.js) and [templates/session.js](templates/session.js) as the default implementation base.
6. Use [examples/usage.js](examples/usage.js) for service-layer usage patterns.

# Adaptation Notes

Phần này giúp điều chỉnh skill cho đúng convention của từng project.
- Rename env keys, route paths, and aliases to match the app instead of hard-coding this sample project's names.
- If the app uses RTK Query or another data layer, keep transport concerns in the shared client and business data fetching in the data layer.
- If the backend returns a custom refresh or session-expired status, adapt the guard conditions without duplicating the overall flow.
