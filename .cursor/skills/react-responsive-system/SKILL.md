---
name: react-responsive-system
description: Guides building or refactoring responsive React interfaces with consistent breakpoint behavior, mobile-first layout adaptation, sidebar and navigation patterns, scalable content density, and practical rules for desktop, tablet, and phone usability.
---

# Purpose

Dung skill nay khi task lien quan den responsive layout, responsive component, hoac can chuan hoa UI cho nhieu kich thuoc man hinh.
Use this skill when the task involves:

- responsive pages
- mobile-first layout adaptation
- sidebar or drawer behavior on small screens
- responsive tables, forms, cards, and dashboards
- breakpoint decisions across phone, tablet, and desktop
- improving usability on many device sizes

# Rules

Skill nay chuan hoa responsive behavior cho toan bo app.
- Design mobile-first, then scale up for larger screens.
- Keep layout changes intentional across `sm`, `md`, `lg`, and `xl` breakpoints.
- Prefer content reflow over shrinking everything into unreadable dense UI.
- Use drawers, collapses, or stacked sections on smaller screens instead of forcing desktop layout everywhere.
- Keep tap targets, spacing, and reading width usable on touch devices.
- Responsive behavior should stay predictable across pages, not reinvented per screen.
- Avoid horizontal overflow unless the content truly requires it.

# Workflow

Doc reference theo dung loai responsive problem.
1. Read [references/breakpoint-strategy.md](references/breakpoint-strategy.md) when deciding how the layout should adapt across phone, tablet, and desktop.
2. Read [references/layout-adaptation.md](references/layout-adaptation.md) when working on page shells, sidebars, headers, and multi-column sections.
3. Read [references/component-patterns.md](references/component-patterns.md) when adapting cards, tables, forms, filters, and action bars.
4. Read [references/content-density.md](references/content-density.md) when tuning spacing, typography, and information density across devices.
5. Read [references/responsive-testing.md](references/responsive-testing.md) when verifying behavior and avoiding breakpoint regressions.
6. Reuse [templates/page-shell.jsx](templates/page-shell.jsx) and [templates/sidebar-layout.jsx](templates/sidebar-layout.jsx) as the baseline responsive structure.
7. Use [examples/responsive-dashboard.jsx](examples/responsive-dashboard.jsx) as a reference.

# Related Skills

Skill nay phoi hop voi:
- `react-ui-system` for component layers and visual hierarchy
- `react-tailwind` for token-driven styling and breakpoint utilities
- `react-project-structure` for placing responsive helpers and shared layout code
- `react-crud-pattern` for table, filter, and form screens that must work well on mobile
- `react-loading-empty-states` and `react-error-handling` so state UIs remain usable on smaller screens

# Adaptation Notes

Phan nay giup responsive system phu hop voi admin va business app thuc te.
- Prefer stable desktop productivity while still making the app genuinely usable on mobile.
- If a screen is data-heavy, change the presentation pattern on small screens instead of preserving the exact desktop structure.
- Keep responsive helpers reusable so the same layout rules can apply to future pages and features.
