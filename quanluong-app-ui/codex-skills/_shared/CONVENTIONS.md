# Codex Skills Conventions

Tai lieu nay dinh nghia convention chung cho toan bo folder `codex-skills`.
This folder uses three top-level groups:

- `*_skill-name_*` style folders are not used. Each real skill lives in its own clear folder such as `react-http-client/`.
- [`_blueprints`](/Users/khanhquynh/Desktop/quanluong-app/quanluong-app-ui/codex-skills/_blueprints) contains starter structures for creating new skills.
- [`_shared`](/Users/khanhquynh/Desktop/quanluong-app/quanluong-app-ui/codex-skills/_shared) contains reusable prompts and templates that are not standalone skills.

## Skill Folder Shape

Mỗi skill thật nên bám theo cùng một skeleton để dễ copy và bảo trì.
Each real skill should prefer this layout:

```text
skill-name/
  SKILL.md
  agents/openai.yaml
  references/
  templates/
  examples/
```

## Authoring Rules

Các rule này giúp skill gọn, rõ, và dễ trigger hơn khi dùng hằng ngày.
- Keep `SKILL.md` short, focused on trigger conditions, rules, workflow, and navigation.
- Put detailed notes in `references/` instead of repeating them in `SKILL.md`.
- Put reusable code in `templates/`.
- Put tiny usage samples in `examples/`.
- Use English for stable technical naming and either English or Vietnamese for explanations, but stay consistent within one skill.
- Prefer native ESM with `import` / `export` syntax in frontend code and templates.

## Recommended Core Skills

Bo skill nen co it nhat mot skill tong quat cho project-level architecture.
- `react-project-structure`: project-wide folder boundaries, pages/features/components rules, and component extraction heuristics
- `react-http-client`: shared transport and session handling
- `react-api-layer`: backend contract modules, request-response mapping, and error normalization
- `react-data-layer`: query and mutation orchestration, selectors, and screen-facing derived data
- `react-redux-toolkit` and `react-rtk-query`: app state and server-state data layers
- `react-tailwind` and `react-shadcn-ui`: token-based UI system with centralized `index.css` variables and `html.dark` theme switching
- `react-responsive-system`: mobile-first responsive behavior, breakpoint strategy, and reusable layout adaptation patterns
- `react-ui-system`: reusable UI component layers, modern design patterns, and page composition governance
- `react-form-handling`: `react-hook-form` plus Zod for schema-driven forms and reusable form sections
- `react-pagination`: cursor pagination and offset/page pagination patterns for lists and tables
- `react-error-handling`: global error policy, toast feedback, and fallback UI boundaries
- `react-loading-empty-states`: consistent initial loading, background refresh, empty states, and content-ready patterns
- `react-notify-system`: toast versus persistent notifications, unread state, and notification center UI
- `react-crud-pattern`: unified create-read-update-delete orchestration across list screens, forms, pagination, states, and feedback
- `react-auth-system`: login/logout flow, current-user bootstrap, protected routes, session handling, and access control
- `react-routing-system`: public/private/protected route structure, post-login redirect, and permission-based route filtering
