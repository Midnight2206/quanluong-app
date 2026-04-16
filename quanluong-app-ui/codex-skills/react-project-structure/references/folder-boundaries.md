# Folder Boundaries

Tai lieu nay dinh nghia vai tro cua tung nhom folder trong mot du an React.

## Recommended Top-Level Structure

- `app/`: bootstrap, providers, router, store wiring, and app-level layout
- `pages/`: route-level screens that compose feature modules
- `features/`: business domains such as `users`, `roles`, `payroll`, or `auth`
- `components/`: truly shared UI components reused across features
- `hooks/`: shared custom hooks
- `hocs/`: cross-cutting wrappers used by multiple routes or features
- `services/`: transport clients, API modules, and external integrations
- `utils/`: stateless helpers and pure utilities
- `constants/`: stable app-wide constants
- `types/`: shared types or schemas when the project uses TypeScript
- `assets/`: images, icons, fonts, and static files

## Placement Rules

- Put business-specific code in `features/feature-name/`.
- Put route assembly code in `pages/`, not business logic heavy implementations.
- Put shared presentational building blocks in `components/` only after they are reused.
- Keep one-off helper code close to the feature that owns it.

## Guardrails

- Do not dump everything into `components/`.
- Do not place route-only code in `features/` if it has no reuse value.
- Do not promote code to global scope too early.
