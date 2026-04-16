---
name: backend-config-system
description: Build or refactor backend configuration management in a Node.js Express JavaScript app with centralized env loading, normalized config access, safe defaults, and clear separation between config and business logic.
---

# Purpose

Dung skill nay khi task lien quan den env va config management o backend.
Use this skill when the task involves:

- environment variables
- centralized config files
- config normalization
- runtime settings
- secret-aware configuration
- avoiding scattered `process.env` usage

# Rules

Skill nay chuan hoa config management cho backend.
- Keep configuration loading centralized.
- Read raw `process.env` in one config layer, not all over the codebase.
- Normalize config values such as booleans, numbers, and lists before app code consumes them.
- Fail early for required config that is missing.
- Keep secrets externalized and never hardcode them.
- Services and modules should depend on config values, not on direct env parsing.

# Workflow

Doc reference theo dung bai toan config.
1. Read [references/config-boundary.md](references/config-boundary.md) when deciding where config logic should live.
2. Read [references/env-loading.md](references/env-loading.md) when handling `.env` and runtime environment variables.
3. Read [references/config-normalization.md](references/config-normalization.md) when parsing booleans, numbers, arrays, or URLs.
4. Read [references/required-config.md](references/required-config.md) when deciding what must fail fast at startup.
5. Read [references/secret-handling.md](references/secret-handling.md) when handling passwords, JWT secrets, SMTP credentials, and similar sensitive config.
6. Reuse [templates/env.js](templates/env.js), [templates/config.js](templates/config.js), and [templates/require-env.js](templates/require-env.js) as the baseline.
7. Use [examples/app-config.js](examples/app-config.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-docker-system` for environment-driven container setup
- `backend-auth-system` for JWT, session, and cookie secrets
- `backend-email-system` for SMTP config
- `backend-db-layer` for Prisma and database URLs
- `backend-security-system` for CORS and security-related runtime policy

# Adaptation Notes

Phan nay giup config system khop voi backend hien tai.
- Prefer one `src/config` entrypoint for app settings.
- Keep config names stable and intention-revealing.
- Split config by concern only after the centralized entrypoint exists.
