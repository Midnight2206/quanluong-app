# Module Entrypoints

Entrypoint cua module can ro rang de de scan va de dang wire vao app.

## Typical Entrypoints

- `users.routes.js`: define Express routes and middleware order
- `users.controller.js`: receive request data and call service methods
- `users.service.js`: own business flow and Prisma work
- `users.validator.js`: export Zod-based request validators

## Route Wiring Pattern

- Routes import validators, controllers, and guard middleware.
- Controllers import only services and response helpers.
- Services import Prisma client and module-local helpers.

## Guardrails

- Keep route files declarative.
- Do not hide route registration inside service files.
- Do not let controllers import Prisma or route config.
