---
name: backend-docker-system
description: Guides building or refactoring Docker setup for a Node.js Express JavaScript backend using Dockerfile, docker-compose, environment-driven configuration, and coordinated containers for app, MariaDB, Redis, and Prisma workflows.
---

# Purpose

Dung skill nay khi task lien quan den Docker hoa backend hoac chuan hoa local runtime cho team.
Use this skill when the task involves:

- Dockerizing a Node.js Express backend
- writing `Dockerfile` or `docker-compose.yml`
- running app with MariaDB and Redis in containers
- aligning Docker config with Prisma and environment variables
- improving team onboarding through containerized local setup

# Rules

Skill nay chuan hoa Docker runtime cho backend hien tai.
- Default backend stack is `Node.js + Express + JavaScript`.
- Default runtime dependencies are `MariaDB + Redis` when the feature set needs DB, queue, or schedule support.
- Keep container configuration environment-driven.
- Do not hardcode secrets directly in Docker images or compose files.
- Keep Docker images focused on runtime concerns, not business logic.
- Use healthchecks and service dependencies where they improve startup predictability.
- Keep Prisma schema and migrations in the repository and run them explicitly in a predictable container workflow.

# Workflow

Doc reference theo dung muc tieu Docker hoa.
1. Read [references/container-boundaries.md](references/container-boundaries.md) when deciding what should run in which container.
2. Read [references/dockerfile-rules.md](references/dockerfile-rules.md) when creating or refactoring the app image.
3. Read [references/compose-setup.md](references/compose-setup.md) when wiring app, MariaDB, and Redis together.
4. Read [references/env-and-secrets.md](references/env-and-secrets.md) when handling environment variables safely.
5. Read [references/prisma-in-docker.md](references/prisma-in-docker.md) when coordinating Prisma schema, generate, and migration flows.
6. Reuse [templates/Dockerfile](templates/Dockerfile), [templates/docker-compose.yml](templates/docker-compose.yml), and [templates/.dockerignore](templates/.dockerignore) as the baseline.
7. Use [examples/local-stack.yml](examples/local-stack.yml) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-project-structure` for folder placement and runtime wiring
- `backend-db-layer` for MariaDB and Prisma conventions
- `backend-queue-system` for Redis and BullMQ background processing
- `backend-schedule-system` for scheduled workers
- `backend-auth-system` when cookies, sessions, and runtime env config matter

# Adaptation Notes

Phan nay giup Docker system khop voi du an backend hien tai.
- Prefer one app container image and separate service containers for MariaDB and Redis.
- Keep dev compose easy to run for the whole team.
- If worker and scheduler need separate processes, prefer separate containers that reuse the same source image.
- Keep host-port exposure minimal and explicit.
