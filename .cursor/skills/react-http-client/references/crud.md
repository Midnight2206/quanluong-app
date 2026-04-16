# CRUD Usage Pattern

Mẫu này dành cho cách tiêu thụ shared HTTP client từ service hoặc API module.
Use the shared HTTP client in service or API modules, then consume those modules from TanStack Query hooks or feature logic.

## Typical Flow

Đây là flow CRUD phổ biến trong app quản trị hoặc business app.
1. Fetch a list or detail record through a service module.
2. Render data in the page or feature UI.
3. Submit create, update, or delete actions through the same service layer.
4. Invalidate or refetch data in the data layer after mutations.

## Guardrails

Giữ ranh giới rõ giữa UI, data layer, và transport layer.
- Do not call transport code directly in presentational components.
- Keep UI state and API orchestration separate.
- If the app already uses TanStack Query, prefer it for caching and invalidation, while the shared client handles transport defaults.
