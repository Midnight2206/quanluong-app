---
name: react-rtk-query
description: Build or update React data fetching with RTK Query using createApi, endpoint definitions, tag-based cache invalidation, custom baseQuery, and generated hooks.
---

# Purpose

Dung skill nay khi task lien quan den server-state caching bang RTK Query.
Use this skill when the task involves:

- `createApi`
- query and mutation endpoints
- cache tags and invalidation
- generated hooks
- API layer integration with Redux Toolkit

# Rules

RTK Query nen so huu server cache, con slice chi giu client state hoac orchestration.
- Prefer `react-rtk-query` for standard API fetching and caching flows.
- Keep endpoint definitions grouped by domain or injected into a shared base API.
- Use tags intentionally so cache invalidation stays predictable.
- Reuse a shared `baseQuery` instead of duplicating transport logic in every endpoint file.
- Integrate with the existing HTTP client if the app already centralizes auth refresh and session handling there.

# Workflow

Doc dung reference de chon dung pattern RTK Query.
1. Read [references/api-architecture.md](references/api-architecture.md) for base API structure and endpoint ownership.
2. Read [references/base-query.md](references/base-query.md) when integrating RTK Query with a custom HTTP client.
3. Read [references/cache-tags.md](references/cache-tags.md) when the task needs invalidation, re-fetching, or optimistic updates.
4. Reuse [templates/axiosBaseQuery.js](templates/axiosBaseQuery.js) and [templates/baseApi.js](templates/baseApi.js) as the default starting point.
5. Use [examples/usage.js](examples/usage.js) for hook-level consumption patterns.

# Adaptation Notes

Skill nay se manh nhat khi app da co RTK va HTTP client dung chung.
- If the project already has a shared axios client with refresh handling, adapt the custom base query to reuse it.
- Keep non-cache UI state in slices or local component state.
- Split very large APIs by domain using endpoint injection instead of one giant endpoint file.
