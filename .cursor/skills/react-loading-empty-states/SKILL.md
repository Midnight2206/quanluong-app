---
name: react-loading-empty-states
description: Guides building or refactoring React loading and empty states with clear distinction between initial loading, background refreshing, empty results, and content-ready views, while staying aligned with error handling and data-layer status.
---

# Purpose

Dung skill nay khi task lien quan den cach hien thi loading state, empty state, va content state trong React app.
Use this skill when the task involves:

- loading spinners or skeletons
- empty states
- list or table state presentation
- distinguishing loading from error
- background refresh indicators

# Rules

Skill nay chuan hoa cach hien thi trang thai du lieu trong UI.
- Distinguish initial loading from background refreshing.
- Treat empty state as a successful data state, not as an error.
- Keep error state separate from empty state and loading state.
- Prefer skeletons or structural placeholders for first-load layout stability.
- Prefer subtle indicators for background refresh when existing data is already visible.
- Keep state rendering logic centralized at the screen, section, or container level when possible.

# Workflow

Doc reference truoc khi thiet ke state UI.
1. Read [references/state-classification.md](references/state-classification.md) to decide whether the screen is in loading, empty, content, or error state.
2. Read [references/loading-patterns.md](references/loading-patterns.md) when choosing between skeletons, spinners, and refresh indicators.
3. Read [references/empty-state-patterns.md](references/empty-state-patterns.md) when designing no-data views.
4. Read [references/data-layer-integration.md](references/data-layer-integration.md) when mapping TanStack Query, service, or hook status into UI states.
5. Reuse [templates/list-state-switch.jsx](templates/list-state-switch.jsx) and [templates/empty-state.jsx](templates/empty-state.jsx) as the baseline pattern.
6. Use [examples/table-states.jsx](examples/table-states.jsx) and [examples/refresh-banner.jsx](examples/refresh-banner.jsx) as references.

# Adaptation Notes

Phan nay giup state presentation khop voi tung loai man hinh.
- If the screen is table-heavy, prefer stable layout skeletons over full-page spinners.
- If filters are applied, empty states should explain that no results match the current filters.
- Pair this skill with `react-error-handling` so fallback UI and empty states are not mixed together.
