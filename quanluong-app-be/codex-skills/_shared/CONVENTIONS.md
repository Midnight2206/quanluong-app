# Backend Codex Skills Conventions

Tai lieu nay dinh nghia convention chung cho bo `codex-skills` cua backend.

## Top-Level Groups

- real skills live in their own folders such as `backend-project-structure/`
- [`_blueprints`](/Users/khanhquynh/Desktop/quanluong-app/quanluong-app-be/codex-skills/_blueprints) contains starter templates for new backend skills
- [`_shared`](/Users/khanhquynh/Desktop/quanluong-app/quanluong-app-be/codex-skills/_shared) contains reusable prompts and templates that are not standalone skills

## Skill Folder Shape

Each backend skill should prefer this layout:

```text
skill-name/
  SKILL.md
  agents/openai.yaml
  references/
  templates/
  examples/
```

## Authoring Rules

- Keep `SKILL.md` short, procedural, and focused on trigger conditions and workflow.
- Put backend reference details in `references/`.
- Put code scaffolds in `templates/`.
- Put small workflow examples in `examples/`.
- Use English for stable technical naming; explanations may be English or Vietnamese, but stay consistent inside one skill.
- This backend skill set currently targets `Node.js + Express + JavaScript`.
- Prefer native ESM with `import` / `export` syntax across backend source code and templates.
- Prefer layered architecture guidance that fits Express routing, controller, service, Prisma, validator, and middleware boundaries.

## Recommended Core Skills

- `backend-project-structure`: project architecture, folder boundaries, and module ownership
- `backend-module-structure`: per-domain module shape, entrypoints, and local-versus-shared code rules
- `backend-controller-layer`: thin Express controllers that only receive requests, call services, and return responses
- `backend-db-layer`: MariaDB and Prisma schema, migration, transaction, and query safety rules
- `backend-auth-system`: JWT, session, httpOnly cookies, and permission-aware route protection aligned with frontend auth
- `backend-api-contract`: route contract, controller boundary, request-response shape, and status code rules
- `backend-response-system`: unified success and error response envelopes
- `backend-caching-system`: Redis caching, cache-aside reads, TTL policy, and explicit invalidation for performance-sensitive paths
- `backend-config-system`: centralized environment loading, normalized config access, and fail-fast required runtime settings
- `backend-logger-system`: structured logs, request context, and safe logging conventions
- `backend-middleware-system`: ordered Express middleware for request context, auth, validation, and permission checks
- `backend-audit-log`: append-style audit event recording for important business actions
- `backend-crud-system`: unified backend CRUD with shared listing contract, soft delete, PATCH, and PUT semantics
- `backend-docker-system`: Dockerfile, docker-compose, container boundaries, and environment-driven local stack setup
- `backend-email-system`: SMTP transport, reusable templates, and consistent outbound or inbound mail workflows
- `backend-file-upload-system`: upload boundaries, file validation, safe storage, and async post-upload processing
- `backend-queue-system`: Redis and BullMQ background jobs for long-running, non-immediate tasks
- `backend-schedule-system`: recurring automatic tasks and time-based triggers that call services or enqueue jobs
- `backend-security-system`: rate limiting, CORS, Helmet, and input sanitization for request-boundary hardening
- `backend-service-layer`: business logic orchestration and transaction-safe flow ownership
- `backend-validation-layer`: input validation, DTO/schema parsing, and boundary-safe normalization
- `backend-error-handling`: application errors, HTTP mapping, and centralized error middleware
