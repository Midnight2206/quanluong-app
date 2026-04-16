# Folder Boundaries

Tai lieu nay dinh nghia vai tro cua tung nhom folder trong backend.

## Recommended Top-Level Structure

- `src/app/`: Express app creation, bootstrap, and route mounting
- `src/config/`: environment config and app settings
- `src/modules/`: business domains such as `auth`, `users`, `payroll`
- `src/shared/`: shared utilities, constants, and reusable helpers
- `src/infra/`: database, cache, mailers, queues, and external clients
- `src/middlewares/`: Express middleware
- `src/errors/`: shared error types and centralized error mapping

## Placement Rules

- put business-domain code in `src/modules/<domain>/`
- put Express bootstrap and app wiring outside business modules
- keep infra adapters outside domain services
- keep route registration close to the module that owns it

## Guardrails

- Do not dump business rules into shared helpers.
- Do not place persistence or transport code directly in controllers.
- Do not promote code to shared scope too early.
