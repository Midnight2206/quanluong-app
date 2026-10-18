---
name: react-tailwind
description: Guides building or refactoring React UI with Tailwind CSS using centralized CSS variables in index.css, class-based dark mode on the html element, localStorage theme persistence, and token-first styling instead of hard-coded values.
---

# Purpose

Dung skill nay khi task lien quan den Tailwind CSS, design token, theme mode, hoac can chuan hoa giao dien bang bien CSS.
Use this skill when the task involves:

- Tailwind CSS setup or refactor
- `index.css` theme variables
- dark mode and light mode
- token-based styling
- reducing hard-coded colors, spacing, or radii

# Rules

Skill nay phai giu mot UI system nhat quan va de doi giao dien ve sau.
- Define shared CSS variables in `index.css` for colors, radius, spacing aliases, shadows, and other reusable tokens.
- Use the `dark` class on the `html` element to switch dark mode.
- Persist the selected theme mode in `localStorage`.
- Prefer `bg-[hsl(var(--card))]`, `text-[hsl(var(--foreground))]`, or equivalent token-based mappings over raw color literals.
- Avoid hard-coded visual values in components when the value belongs to the design system.
- Keep one-off values rare and justified by the feature.

# Workflow

Doc reference truoc khi viet hoac refactor UI.
1. Read [references/theme-tokens.md](references/theme-tokens.md) when working with colors, spacing, radius, or shared CSS values.
2. Read [references/dark-mode.md](references/dark-mode.md) when implementing theme switching or hydration behavior.
3. Read [references/tailwind-usage.md](references/tailwind-usage.md) when deciding between utility classes and CSS variables.
4. Reuse [templates/index.css](templates/index.css) as the baseline token system.
5. Reuse [templates/theme.js](templates/theme.js) when wiring the `html.dark` toggle and `localStorage` persistence.
6. Use [examples/theme-toggle.jsx](examples/theme-toggle.jsx) for UI integration patterns.

# Adaptation Notes

Phan nay giup skill thich nghi voi setup Tailwind cua du an.
- Align token naming with the app's existing naming if one already exists.
- Keep semantic tokens like `--background`, `--foreground`, `--primary`, and `--muted` more stable than raw palette names.
- If the project uses shadcn/ui, keep Tailwind tokens compatible with the same variable system.
