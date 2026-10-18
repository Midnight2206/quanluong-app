# Quân Lương — Design System (MASTER)

Source of truth for UI work in `apps/web`, `apps/superadmin`, `apps/supplier` and `packages/shared`.
Derived from `ui-ux-pro-max` (`search.py "military kitchen logistics management dashboard data-dense tables forms government" --design-system`),
then adapted: the generator's landing-page pattern and Fira/mono headings were dropped (this is an internal ops app, Vietnamese text).
Tokens live in `packages/shared/src/index.css`; Tailwind maps them in each app's `tailwind.config.js`.

## Style
**Data-Dense Dashboard**: information first, calm surfaces, minimal decoration.
- Flat app background (no gradients, blobs or grid textures); white cards on cool slate.
- Hairline 1px borders carry structure; shadows only for floating layers (menus, dialogs, tooltips).
- One restrained accent (user-selectable); status colours are semantic only.

## Colour (HSL tokens, light / dark)
| Token | Light | Dark | Use |
|---|---|---|---|
| background | 210 25% 97.5% | 222 44% 7% | app canvas |
| card | 0 0% 100% | 222 36% 10.5% | panels, tables |
| foreground | 222 47% 11% | 210 33% 95% | body text |
| muted-foreground | 215 19% 35% | 215 20% 71% | labels, secondary text |
| border / input | 214 24% 87% / 215 18% 76% | 218 24% 21% / 217 20% 30% | dividers / field borders |
| primary (teal, default) | 175 80% 24% | 170 62% 52% | primary action, active nav |
| destructive | 0 72% 42% | 0 84% 66% (dark text on it) | delete, errors |
| warning / success / info | 30 92% 28% / 152 72% 23% / 204 88% 30% | 40 92% 62% / 150 55% 56% / 200 85% 68% | status text |

Accent palettes (`html[data-accent]`): teal (default), blue 224 70% 42%, green 152 64% 25%, olive 80 34% 27%, rose 346 66% 40%, amber 28 88% 30% (light; dark variants are lighter tints with dark foreground).
High contrast (`html[data-contrast="high"]`) forces pure white/black surfaces and 35% / 65% borders.
All 336 text/background pairs (6 accents x light/dark x normal/high contrast x 14 pairs) are >= 4.5:1 (min 5.6:1).

## Typography
- **Be Vietnam Pro** 400/500/600/700 (`next/font/google`, subsets latin + vietnamese, `--font-sans`), system UI fallback.
- Scale (Tailwind): page title `text-xl`/`text-2xl font-semibold`; section `text-base font-semibold`; body/table `text-sm`; dense table/labels `text-xs`; minimum 11px.
- Numbers: `tabular-nums` (global for `table`, numeric inputs, `output`, `time`).
- Headings `letter-spacing: -0.011em`; no all-caps headlines, uppercase only for tiny section labels.

## Shape and depth
- `--radius: 0.5rem` → `rounded-lg` 8px (cards, inputs, buttons), `rounded-md` 6px, `rounded-sm` 4px, `rounded-xl` 12px (dialogs only).
- Shadows: `shadow-soft` (1px hairline), `shadow-panel` (cards, very low), `shadow-float` (menus, dialogs, tooltips).
- Spacing: 4px grid; card padding `p-3 sm:p-4`; page gutter `px-3 sm:px-4 lg:px-6`.

## Interaction
- `cursor: pointer` on all clickable controls (global base rule), `not-allowed` when disabled.
- Hover/active via colour only (`transition-colors`, 150–200ms); no scale/translate on hover.
- Focus: global `:focus-visible` 2px ring in `--ring`; components may use `focus-visible:ring-2`.
- `prefers-reduced-motion`: animations/transitions reduced to ~0 globally.
- Icons: lucide-react only, 16px in controls, 20px in navigation; no emoji icons.

## Content
- No explanatory `<p>` blurbs under titles; keep only errors, empty states and critical warnings.

## Pre-delivery checklist
- [ ] contrast >= 4.5:1 (run `node contrast check` against index.css tokens)
- [ ] focus visible, cursor-pointer, hover transitions 150–300ms
- [ ] 375 / 768 / 1024 / 1440 without horizontal page scroll (wide tables scroll locally)
- [ ] no layout shift on hover/load, reduced motion respected
- [ ] no gradients, glass, emoji icons, oversized radii
