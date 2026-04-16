---
name: backend-security-system
description: Guides building or refactoring backend security middleware in a Node.js Express JavaScript app using rate limiting, CORS, Helmet, and input sanitization with clear request-boundary protections and safe defaults.
---

# Purpose

Dung skill nay khi task lien quan den security middleware va boundary protection o backend.
Use this skill when the task involves:

- rate limiting
- CORS policy
- Helmet headers
- input sanitization
- request-boundary hardening
- Express app security defaults

# Rules

Skill nay chuan hoa cac lop bao ve co ban cho backend.
- Apply security controls at the request boundary through middleware.
- Use `Helmet` for security-related HTTP headers.
- Use explicit `CORS` policy instead of permissive wildcard defaults.
- Use `rate limiting` on public or abuse-prone endpoints.
- Sanitize request input before business logic consumes it.
- Keep security middleware configurable by environment.
- Forward security failures through centralized error handling when appropriate.

# Workflow

Doc reference theo dung loai protection can them.
1. Read [references/security-boundary.md](references/security-boundary.md) when deciding what belongs in security middleware.
2. Read [references/rate-limit.md](references/rate-limit.md) when protecting login, public APIs, or abuse-prone endpoints.
3. Read [references/cors-policy.md](references/cors-policy.md) when defining allowed origins, methods, and credentials behavior.
4. Read [references/helmet-usage.md](references/helmet-usage.md) when configuring secure HTTP headers.
5. Read [references/input-sanitization.md](references/input-sanitization.md) when normalizing or rejecting unsafe request payloads.
6. Reuse [templates/rate-limit.js](templates/rate-limit.js), [templates/cors.js](templates/cors.js), [templates/helmet.js](templates/helmet.js), and [templates/sanitize-input.js](templates/sanitize-input.js) as the baseline.
7. Use [examples/app-security-pipeline.js](examples/app-security-pipeline.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-middleware-system` for request pipeline ordering
- `backend-validation-layer` for Zod-based request parsing after sanitization
- `backend-auth-system` for protecting login and session-related endpoints
- `backend-error-handling` for safe failure responses
- `backend-api-contract` for public-facing error behavior

# Adaptation Notes

Phan nay giup security system khop voi backend hien tai.
- Keep security defaults strict enough for production but configurable for local development.
- Prefer allowlists over broad wildcard rules.
- Sanitization should support validation, not replace it.
- Security middleware should stay small, explicit, and easy to audit.
