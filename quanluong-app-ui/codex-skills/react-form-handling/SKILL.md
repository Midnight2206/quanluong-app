---
name: react-form-handling
description: Build or refactor React forms with react-hook-form and Zod using schema-based validation, reusable field components, feature-scoped form modules, and maintainable form section extraction.
---

# Purpose

Dung skill nay khi task lien quan den form handling trong React va can validation schema ro rang.
Use this skill when the task involves:

- `react-hook-form`
- form validation
- `zod` schemas
- submit handling and field errors
- reusable form fields or form sections

# Rules

Skill nay mac dinh dung `react-hook-form` cho form state va `zod` cho validation.
- Use `react-hook-form` as the default form state library.
- Use `zod` as the default schema validation library.
- Keep schemas close to the feature that owns the form.
- Keep submit orchestration outside small presentational field components.
- Extract repeated field groups or form sections when they appear in two or more places.
- Split very large forms into subcomponents or sections before the file becomes hard to maintain.

# Workflow

Doc reference theo nhu cau cua form.
1. Read [references/library-choice.md](references/library-choice.md) for the default library decision.
2. Read [references/schema-pattern.md](references/schema-pattern.md) when defining a Zod schema for the form.
3. Read [references/form-structure.md](references/form-structure.md) when deciding where the form, schema, and submit logic should live.
4. Read [references/component-extraction.md](references/component-extraction.md) when the form grows too large or repeats sections.
5. Reuse [templates/form-schema.js](templates/form-schema.js) and [templates/form-component.jsx](templates/form-component.jsx) as the starting point.
6. Use [examples/user-form.jsx](examples/user-form.jsx) for a full flow with `zodResolver`.

# Adaptation Notes

Phan nay giup skill phu hop voi feature structure cua du an.
- Keep form-specific code inside `features/<name>/` unless many features share it.
- Promote reusable field wrappers to shared `components/` only after real reuse appears.
- If the form writes to server state, keep transport in services or `react-rtk-query`, not inside field components.
