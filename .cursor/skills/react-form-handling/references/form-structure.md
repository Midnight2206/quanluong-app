# Form Structure

Form nen duoc chia thanh cac lop ro rang de de bao tri.

## Recommended Responsibilities

- schema file: validation and data shape
- form component: `useForm`, submit wiring, and section composition
- field section components: grouped UI blocks with small prop APIs
- service or mutation layer: API calls and persistence

## Placement Rules

- keep business-specific forms inside `features/<name>/components/` or a nearby form folder
- keep shared field primitives in shared `components/` only after reuse
- let pages compose forms instead of owning all form logic

## Guardrails

- Do not keep API mutation logic inside tiny input components.
- Do not turn pages into giant form files.
- Keep form helpers close to the feature until real reuse appears.
