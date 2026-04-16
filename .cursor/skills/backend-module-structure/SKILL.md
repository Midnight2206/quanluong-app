---
name: backend-module-structure
description: Guides building or refactoring domain modules in a Node.js Express JavaScript backend using a consistent per-module shape with routes, controllers, services, validators, mappers, Prisma-aware boundaries, and native ESM modules.
---

# Purpose

Dung skill nay khi task lien quan den cau truc cua tung module/domain trong backend.
Use this skill when the task involves:

- creating a new backend module
- refactoring an existing domain module
- standardizing `src/modules/<domain>` structure
- deciding which files belong inside a module
- separating route, controller, service, validator, and mapper responsibilities inside one domain

# Rules

Skill nay chuan hoa shape cua tung business module.
- Organize each business capability under one domain module such as `src/modules/users`.
- Use native ESM `import` / `export` syntax in every module file.
- A module should usually contain route, controller, service, validator, and mapper files.
- Controllers stay thin and only work with services.
- Services own business orchestration and may access Prisma directly.
- Validators parse `req.body`, `req.query`, and `req.params` close to the route boundary.
- Keep module-local code inside the module until at least two domains need to share it.
- Do not let one module become a dumping ground for unrelated business responsibilities.
- Split oversized files before one file grows past a maintainable size.

# Workflow

Doc reference theo dung muc tieu cua module.
1. Read [references/module-boundary.md](references/module-boundary.md) when deciding what belongs to one domain.
2. Read [references/module-entrypoints.md](references/module-entrypoints.md) when creating route and controller entrypoints.
3. Read [references/module-internal-flow.md](references/module-internal-flow.md) when wiring validator, controller, service, and Prisma access.
4. Read [references/module-reuse-rules.md](references/module-reuse-rules.md) when deciding whether code stays local or moves to shared folders.
5. Reuse [templates/module-tree.txt](templates/module-tree.txt) as the baseline module shape.
6. Use [examples/users-module-layout.txt](examples/users-module-layout.txt) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-project-structure` for whole-project architecture
- `backend-controller-layer` for thin HTTP boundaries
- `backend-service-layer` for business logic ownership
- `backend-validation-layer` for Zod request parsing
- `backend-db-layer` for Prisma access and transaction rules
- `backend-crud-system` when the module exposes CRUD endpoints

# Adaptation Notes

Phan nay giup module structure khop voi backend hien tai.
- This project targets `Node.js + Express + JavaScript`.
- Prefer explicit file names such as `users.routes.js`, `users.controller.js`, and `users.service.js`.
- Keep feature-specific helpers local to the module before promoting them to shared infrastructure.
- If one module grows too large, split by subdomain or use nested files with clear ownership instead of piling everything into one service file.
