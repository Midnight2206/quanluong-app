---
name: react-crud-pattern
description: Build or refactor React CRUD features using a consistent pattern for list screens, filters, pagination, form flows, create-update-delete actions, loading-empty-error states, and feedback orchestration across the app.
---

# Purpose

Dung skill nay khi task lien quan den tao hoac chuan hoa mot CRUD feature trong React app.
Use this skill when the task involves:

- create, read, update, delete flows
- admin tables or list screens
- modal or page-based form flows
- CRUD feature scaffolding
- standardizing entity management screens

# Rules

Skill nay la orchestration layer cho cac skill khac trong bo chuan.
- Treat each CRUD feature as one cohesive flow: list, filter, paginate, create, update, delete, and feedback.
- Keep list rendering, form handling, and mutation orchestration in separate modules.
- Keep business-specific code inside `features/<entity>/`.
- Use shared UI and shared logic only after real reuse appears.
- Keep CRUD screens predictable so users see the same interaction model across entities.
- Prefer one primary interaction model per entity: modal-based editing or dedicated page-based editing, unless the product clearly needs both.

# Workflow

Doc theo dung thu tu de giu CRUD flow dong bo.
1. Read [references/feature-shape.md](references/feature-shape.md) to scaffold the feature folder and screen layout.
2. Read [references/list-screen.md](references/list-screen.md) when building the table or list view.
3. Read [references/form-flow.md](references/form-flow.md) when building create or update forms.
4. Read [references/delete-flow.md](references/delete-flow.md) when handling destructive actions safely.
5. Read [references/feedback-and-states.md](references/feedback-and-states.md) when wiring loading, empty, error, toast, and notification behavior.
6. Reuse [templates/crud-feature-tree.txt](templates/crud-feature-tree.txt) and [templates/crud-checklist.md](templates/crud-checklist.md) as the baseline playbook.
7. Use [examples/users-crud-layout.txt](examples/users-crud-layout.txt) as a reference for a full CRUD feature.

# Related Skills

Skill nay nen phoi hop voi cac skill sau thay vi lap lai chi tiet cua chung.
- `react-project-structure` for folder boundaries
- `react-form-handling` for create and update forms
- `react-pagination` for list navigation
- `react-loading-empty-states` for list state presentation
- `react-error-handling` for error policy
- `react-notify-system` for user feedback and persistent notifications
- `react-rtk-query` or service-layer skills for data fetching and mutations

# Adaptation Notes

Phan nay giup CRUD pattern khop voi tung entity cu the.
- If the entity is simple and low-risk, modal create or update is usually enough.
- If the entity has many sections or complex validation, prefer a dedicated create or edit page.
- If delete is destructive or irreversible, require confirmation UI and clear user messaging.
