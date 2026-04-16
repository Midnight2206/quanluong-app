---
name: backend-project-structure
description: Build or refactor a Node.js Express backend in JavaScript using a consistent structure with app bootstrap, routes, controllers, services, validators, middleware, shared infrastructure boundaries, and native ESM modules.
---

# Purpose

Dung skill nay khi task lien quan den kien truc tong the cua backend hoac can sap xep lai folder structure chuan.
Use this skill when the task involves:

- Node.js Express backend structure
- JavaScript server architecture
- backend folder structure
- routes, controllers, services, repositories, validators
- controllers, services, repositories, validators, middleware
- module boundaries
- refactoring large backend modules
- standardizing backend architecture

# Rules

Skill nay la rule chung cho toan bo backend.
- Default stack for this project is `Node.js + Express + JavaScript`.
- Use native ESM `import` / `export` syntax across the backend.
- Organize by domain first when the code belongs to a business capability.
- Keep Express route files thin and delegate request handling to controllers.
- Keep transport entry points thin and move business logic to services.
- In this project, services may access MariaDB through Prisma directly.
- Keep validation close to the boundary that receives input.
- Split large files before one module becomes a dumping ground.
- Promote shared infrastructure only after multiple domains reuse it.

# Workflow

Doc dung reference truoc khi sap xep hoac tao code moi.
1. Read [references/folder-boundaries.md](references/folder-boundaries.md) when deciding where backend code should live.
2. Read [references/module-shape.md](references/module-shape.md) when creating a new domain module.
3. Read [references/layer-rules.md](references/layer-rules.md) when separating controller, service, repository, and validator responsibilities.
4. Reuse [templates/project-tree.txt](templates/project-tree.txt) as the baseline backend structure.
5. Use [examples/domain-module-layout.txt](examples/domain-module-layout.txt) as a reference.
6. Keep route registration and Express bootstrap aligned with the same folder structure.

# Adaptation Notes

Phan nay giup skill phu hop voi backend hien tai.
- This skill is optimized for `Node.js + Express + JavaScript`, not for NestJS or other frameworks.
- This project standardizes on `MariaDB + Prisma` for database structure and data access.
- Prefer plain `.js` ESM modules and simple dependency flow unless the project later standardizes on TypeScript.
- Keep infra code separate from business-domain modules.
- Keep file names explicit by responsibility and domain.
