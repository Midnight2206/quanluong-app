---
name: react-pagination
description: Build or refactor React pagination flows using either cursor pagination or offset/page pagination, with clear API contract selection, UI state management, and maintainable integration with data fetching layers.
---

# Purpose

Dung skill nay khi task lien quan den phan trang du lieu trong React hoac API layer.
Use this skill when the task involves:

- pagination UI
- cursor pagination
- offset pagination
- page-based tables or lists
- integrating pagination with `react-rtk-query`, services, or hooks

# Rules

Skill nay ho tro hai pattern chinh: `cursor pagination` va `offset/page pagination`.
- Use `cursor pagination` for large, changing datasets or infinite-load style experiences.
- Use `offset/page pagination` for classic tables, admin lists, and explicit page navigation.
- Keep pagination state close to the screen or data layer that owns it.
- Keep transport parameters aligned with the backend contract instead of inventing a mixed format.
- Keep pagination UI separate from the API contract mapping when possible.

# Workflow

Doc reference de chon dung pattern phan trang.
1. Read [references/pattern-selection.md](references/pattern-selection.md) first to choose between cursor and offset/page pagination.
2. Read [references/cursor-pagination.md](references/cursor-pagination.md) when the backend returns cursors such as `nextCursor` or `prevCursor`.
3. Read [references/offset-pagination.md](references/offset-pagination.md) when the backend uses `page`, `limit`, `offset`, or `total`.
4. Reuse [templates/cursor-pagination.js](templates/cursor-pagination.js) for cursor-based list state.
5. Reuse [templates/offset-pagination.js](templates/offset-pagination.js) for page-based tables and lists.
6. Use [examples/cursor-list.jsx](examples/cursor-list.jsx) and [examples/offset-table.jsx](examples/offset-table.jsx) as UI references.

# Adaptation Notes

Phan nay giup skill khop voi backend contract thuc te.
- If the API returns both page metadata and a cursor, choose one primary pattern and keep the UI consistent with it.
- Keep table controls and list rendering simple; pagination complexity should stay in a hook, service, or data layer.
- If the backend contract is unstable, wrap it in a small adapter before the UI consumes it.
