---
name: backend-logger-system
description: Build or refactor structured logging in a Node.js Express JavaScript backend with centralized logger usage, request-aware context, safe log levels, and security-conscious log payloads.
---

# Purpose

Dung skill nay khi task lien quan den logging va observability co cau truc o backend.
Use this skill when the task involves:

- structured logging
- request logging
- error logging
- log levels
- request id and trace context
- log payload safety

# Rules

Skill nay chuan hoa logging cho backend.
- Keep one centralized logger abstraction for the app.
- Use structured logs instead of scattered string concatenation.
- Include stable request context when logging request-bound work.
- Choose log levels intentionally such as `debug`, `info`, `warn`, and `error`.
- Never log secrets, passwords, tokens, or unsafe personal data.
- Logging should support debugging and operations, not replace business flow control.

# Workflow

Doc reference theo dung bai toan logging.
1. Read [references/logging-boundary.md](references/logging-boundary.md) when deciding what should be logged.
2. Read [references/log-levels.md](references/log-levels.md) when choosing log severity.
3. Read [references/request-context.md](references/request-context.md) when attaching request-aware fields.
4. Read [references/log-safety.md](references/log-safety.md) when handling sensitive payloads.
5. Reuse [templates/logger.js](templates/logger.js), [templates/request-logger.js](templates/request-logger.js), and [templates/log-context.js](templates/log-context.js) as the baseline.
6. Use [examples/controller-log-flow.js](examples/controller-log-flow.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-middleware-system` for request-id and request logging middleware
- `backend-error-handling` for error logging boundaries
- `backend-audit-log` because audit events and logs solve different problems
- `backend-queue-system` and `backend-schedule-system` for worker and scheduler logging

# Adaptation Notes

Phan nay giup logger system khop voi backend hien tai.
- Prefer JSON-friendly log shapes.
- Keep log field names stable across modules.
- Add enough context to debug, but keep logs safe and lean.
