# Security Boundary

Bao ve boundary cua request la lop phong thu dau tien cua backend.

## What Belongs Here

- rate limiting
- CORS policy
- security headers
- request sanitization
- abuse protection on public endpoints

## What Stays Outside

- business logic
- domain authorization rules
- database logic
- response business mapping

## Guardrails

- Security middleware should run before controllers.
- Security policy should be explicit and reviewable.
- Do not hide critical security behavior inside unrelated helpers.
