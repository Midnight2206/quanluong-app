---
name: react-data-layer
description: Guides building or refactoring a React data layer that manages server-state consumption, query and mutation orchestration, selectors, derived view state, and stable boundaries between API modules and UI components.
---

# Purpose

Dung skill nay khi task lien quan den lop du lieu ma UI se tieu thu.
Use this skill when the task involves:

- query and mutation orchestration
- selectors and derived data
- server-state consumption
- feature data hooks
- cache-aware screen state

# Rules

Skill nay la lop cau noi giua API layer va UI.
- Keep data fetching, caching, and derived screen data out of presentational components.
- Let the data layer expose stable outputs the UI can render easily.
- Keep server cache concerns in TanStack Query (or another dedicated data solution) when available.
- Keep selectors and derived data near the feature or shared domain that owns them.
- Do not let screens reimplement the same loading, empty, error, and transformation logic repeatedly.
- Separate transport concerns from data orchestration concerns.

# Workflow

Doc reference theo dung loai bai toan du lieu.
1. Read [references/layer-boundary.md](references/layer-boundary.md) to distinguish API layer, data layer, and UI layer.
2. Read [references/query-orchestration.md](references/query-orchestration.md) when building list, detail, or dependent query flows.
3. Read [references/derived-state.md](references/derived-state.md) when computing view-friendly data from raw responses.
4. Read [references/mutation-flow.md](references/mutation-flow.md) when coordinating optimistic updates, refetch, invalidation, or post-submit state.
5. Reuse [templates/use-resource-data.js](templates/use-resource-data.js) and [templates/selectors.js](templates/selectors.js) as the baseline.
6. Use [examples/users-data-flow.js](examples/users-data-flow.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `react-api-layer` for backend contract access
- `tanstack-react-query` for cache-first server-state management
- `zustand-app-state` for client global state (auth, route access) alongside Query
- `react-loading-empty-states` for UI state presentation
- `react-crud-pattern` for entity-management workflows

# Adaptation Notes

Phan nay giup data layer khop voi quy mo cua feature.
- If TanStack Query already covers the screen well, keep the extra data layer very thin.
- If multiple screens reuse the same derived data, extract selectors or feature hooks instead of repeating transformations.
- Keep the UI consuming simple, stable outputs rather than raw nested API payloads.
