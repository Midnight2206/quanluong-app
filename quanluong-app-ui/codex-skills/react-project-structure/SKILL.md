---
name: react-project-structure
description: Build or refactor a React project using a consistent folder architecture with app-level layout, pages, features, components, hooks, HOCs, services, shared utilities, and strict component extraction rules for reuse and file size.
---

# Purpose

Dung skill nay khi task lien quan den kien truc tong the cua du an React hoac can sap xep lai code theo folder structure chuan.
Use this skill when the task involves:

- project or feature folder structure
- `components`, `pages`, `features`, `hooks`, or `hocs`
- extracting large components into smaller pieces
- moving repeated UI into shared modules
- keeping files maintainable as the app grows

# Rules

Skill nay la rule chung cho toan bo du an va nen uu tien truoc khi tao file moi.
- Organize by feature first when the code belongs to a business domain.
- Keep truly shared UI in `components/` and shared logic in `hooks/`, `utils/`, or `services/`.
- Keep route-entry screens in `pages/`.
- Put cross-cutting wrappers in `hocs/` only when composition through hooks or layout components is not enough.
- Split a component when one file grows beyond roughly 500 lines of code.
- Extract a component or helper into a reusable shared module when it is used in two or more places.
- Prefer small, composable files over one large multi-purpose component.

# Workflow

Doc dung reference truoc khi sap xep hoac tao code moi.
1. Read [references/folder-boundaries.md](references/folder-boundaries.md) when deciding where new code should live.
2. Read [references/component-extraction.md](references/component-extraction.md) when a component is too large, too nested, or reused in multiple places.
3. Read [references/feature-module.md](references/feature-module.md) when creating a new business feature.
4. Read [references/pages-and-routing.md](references/pages-and-routing.md) when wiring route-level screens.
5. Reuse [templates/project-tree.txt](templates/project-tree.txt) as the default React folder skeleton.
6. Use [examples/feature-layout.txt](examples/feature-layout.txt) as a reference when scaffolding a new feature.

# Adaptation Notes

Phan nay dung de dieu chinh skeleton cho dung quy mo va stack cua app.
- If the app already has a stable architecture, align with it instead of forcing a new tree.
- Keep server-state concerns in the data layer such as `react-rtk-query`, not inside presentational components.
- Keep file names and folder names explicit by domain and responsibility.
- If a repeated component is only shared inside one feature, keep it inside that feature before promoting it to global `components/`.
