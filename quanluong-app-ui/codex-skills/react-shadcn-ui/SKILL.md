---
name: react-shadcn-ui
description: Build or refactor React UI with shadcn/ui components that consume centralized index.css theme variables, avoid hard-coded visual values, and stay compatible with html.dark class-based theming persisted in localStorage.
---

# Purpose

Dung skill nay khi task lien quan den shadcn/ui component, design system layer, hoac can tao component UI tai su dung tren nen Tailwind token system.
Use this skill when the task involves:

- shadcn/ui components
- reusable UI primitives
- token-aligned Tailwind styling
- dark mode compatible component design
- extending or composing Radix-based UI patterns

# Rules

Skill nay phai di cung he token cua `index.css`, khong tao mot visual system rieng.
- Keep shadcn/ui components aligned with the shared CSS variable system in `index.css`.
- Prefer semantic classes that consume variables such as `bg-background`, `text-foreground`, or arbitrary values backed by CSS variables.
- Avoid hard-coded colors, radii, and shadow values directly inside component implementations.
- Make dark mode work automatically through the `html.dark` theme class instead of per-component theme logic.
- Extract reusable UI primitives when the same visual pattern appears in two or more places.

# Workflow

Doc reference truoc khi tao hoac sua component UI.
1. Read [references/component-customization.md](references/component-customization.md) when adapting base shadcn/ui components.
2. Read [references/theme-alignment.md](references/theme-alignment.md) when wiring component styles to shared variables.
3. Read [references/reuse-rules.md](references/reuse-rules.md) when deciding whether a visual block should become a shared UI primitive.
4. Reuse [templates/button.jsx](templates/button.jsx) as a baseline token-aware component.
5. Reuse [templates/theme-provider-note.md](templates/theme-provider-note.md) for guidance on theme bootstrap expectations.
6. Use [examples/card-layout.jsx](examples/card-layout.jsx) as a reference for composed UI sections.

# Adaptation Notes

Phan nay dam bao shadcn/ui khop voi toan bo architecture cua du an.
- If the project already has generated shadcn/ui files, extend them instead of creating duplicate primitives.
- Keep visual primitives under shared `components/ui/` when multiple features use them.
- Push business-specific rendering back to `features/` or `pages/`, and keep shadcn/ui primitives presentation-focused.
