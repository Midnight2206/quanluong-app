---
name: react-ui-system
description: Build or refactor a modern React UI system with reusable component layers, consistent design patterns, token-driven styling, clear composition rules, and practical guidance for admin and business application interfaces.
---

# Purpose

Dung skill nay khi task lien quan den he thong UI tong the, component library noi bo, hoac design pattern cho man hinh React.
Use this skill when the task involves:

- reusable UI components
- modern admin or business UI patterns
- page composition and section layout
- consistent visual hierarchy
- design system structure across the app

# Rules

Skill nay la lop governance cho toan bo UI system.
- Separate UI into clear layers: primitives, composed shared components, feature-specific components, and page composition.
- Keep shared components predictable, composable, and token-driven.
- Prefer modern patterns with strong hierarchy, spacing rhythm, and calm density instead of crowded screens.
- Reuse existing UI primitives before creating near-duplicate components.
- Promote components to shared scope only after real reuse appears.
- Keep business-specific rendering out of global `components/ui/`.
- Favor accessible, boring-in-the-right-way interaction patterns over flashy novelty in admin workflows.

# Workflow

Doc reference theo dung muc do cua bai toan UI.
1. Read [references/component-layers.md](references/component-layers.md) to choose the right layer for a new UI component.
2. Read [references/design-patterns.md](references/design-patterns.md) when composing pages, cards, tables, forms, and dashboards.
3. Read [references/visual-hierarchy.md](references/visual-hierarchy.md) when tuning spacing, headings, density, and emphasis.
4. Read [references/reuse-governance.md](references/reuse-governance.md) when deciding whether something should become a shared primitive or stay feature-local.
5. Reuse [templates/ui-structure.txt](templates/ui-structure.txt) and [templates/page-section-pattern.jsx](templates/page-section-pattern.jsx) as the baseline.
6. Use [examples/admin-page-layout.jsx](examples/admin-page-layout.jsx) and [examples/shared-component-stack.txt](examples/shared-component-stack.txt) as references.

# Related Skills

Skill nay phoi hop voi:
- `react-tailwind` for token system and theme variables
- `react-shadcn-ui` for shared UI primitives
- `react-project-structure` for placement of shared versus feature-local components
- `react-loading-empty-states` and `react-error-handling` for stateful screen composition
- `react-crud-pattern` for standard entity-management screens

# Adaptation Notes

Phan nay giup UI system phu hop voi app quan tri va business app hien dai.
- Prefer clean, information-first layouts over overly decorative marketing-style sections.
- Keep visual language consistent across list, form, detail, and dashboard screens.
- If a new pattern appears across multiple features, extract it as a named composed component rather than repeating layout code.
