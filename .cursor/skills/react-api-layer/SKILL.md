---
name: react-api-layer
description: Guides building or refactoring a React API layer with shared transport usage, domain-based endpoint modules, request and response adaptation, error normalization, and clean separation from UI and state orchestration.
---

# Purpose

Dung skill nay khi task lien quan den lop giao tiep backend trong React app.
Use this skill when the task involves:

- API service modules
- endpoint functions
- request and response mapping
- backend contract adapters
- transport abstraction outside components

# Rules

Skill nay chi quan tam den contract va giao tiep voi backend.
- Keep API modules thin, predictable, and domain-based.
- Reuse the shared HTTP client instead of calling raw transport from components.
- Normalize response and error shapes before UI layers consume them.
- Keep serialization, query params, and endpoint paths inside the API layer.
- Do not mix UI state management into API modules.
- Prefer one module per domain or resource rather than one giant API file.

# Workflow

Doc reference theo nhu cau cua contract backend.
1. Read [references/module-shape.md](references/module-shape.md) when creating API modules by domain.
2. Read [references/request-response-mapping.md](references/request-response-mapping.md) when adapting backend payloads for app consumption.
3. Read [references/error-normalization.md](references/error-normalization.md) when standardizing failures before they reach the UI.
4. Read [references/query-params.md](references/query-params.md) when encoding filters, pagination, sort, or search params.
5. Reuse [templates/resource-api.js](templates/resource-api.js) as the baseline.
6. Use [examples/users-api.js](examples/users-api.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `react-http-client` for shared transport, refresh token, and centralized session handling
- `react-pagination` for page, offset, or cursor params
- `react-error-handling` for downstream error policy after normalization
- `react-crud-pattern` for full feature orchestration
- `react-data-layer` for cache and screen-facing data state

# Adaptation Notes

Phan nay giup API layer khop voi backend contract thuc te.
- If the backend contract is inconsistent, isolate those inconsistencies here instead of leaking them to the rest of the app.
- Keep DTO mapping explicit when backend names differ from UI domain terms.
- If the project uses TanStack Query hooks per domain, keep raw HTTP and path construction in API modules; hooks compose `apiRequest` and own cache keys (see `tanstack-react-query`).
