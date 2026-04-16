---
name: backend-error-handling
description: Build or refactor backend error handling with domain error types, centralized middleware, normalized error payloads, safe public messages, and one final layer that catches and serializes all thrown failures without crashing the app.
---

# Purpose

Dung skill nay khi task lien quan den xu ly loi tap trung o backend.
Use this skill when the task involves:

- application errors
- HTTP error mapping
- centralized error middleware
- domain error types
- normalized failure payloads
- preventing app crashes from unhandled request errors

# Rules

Skill nay tach ro loi nghiep vu va loi he thong.
- Use explicit application or domain error types for expected failures.
- Map domain errors to HTTP responses in one centralized place.
- Keep unexpected exceptions distinct from expected business failures.
- Do not leak raw stack traces or internal details to public API responses.
- Keep error payloads stable for frontend consumers.
- All failures should be thrown or forwarded to the centralized error layer.
- The centralized error layer must catch unknown errors and return a safe fallback response instead of letting the app crash.
- Public error messages should be concise and not overly specific when disclosure adds security risk.

# Workflow

Doc reference theo dung loai failure.
1. Read [references/error-types.md](references/error-types.md) when defining domain or application errors.
2. Read [references/http-mapping.md](references/http-mapping.md) when translating errors to status codes and payloads.
3. Read [references/error-middleware.md](references/error-middleware.md) when implementing centralized failure handling.
4. Read [references/security-safe-messages.md](references/security-safe-messages.md) when choosing public error messages.
5. Reuse [templates/app-error.js](templates/app-error.js) and [templates/error-middleware.js](templates/error-middleware.js) as the baseline.
6. Use [examples/error-mapping.js](examples/error-mapping.js) as a reference.

# Adaptation Notes

Phan nay giup error layer khop voi framework va security model.
- Keep logging strategy separate from response serialization when needed.
- Preserve machine-readable error codes for client behavior.
- Centralize auth, validation, and not-found failures into predictable mappings.
- Treat unknown failures as `500` with a safe generic message.
