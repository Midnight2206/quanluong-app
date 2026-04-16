---
name: backend-response-system
description: Guides building or refactoring backend response handling with a unified success and error envelope, centralized serialization, stable HTTP semantics, and clean integration with validation and error middleware in Node.js Express JavaScript apps.
---

# Purpose

Dung skill nay khi task lien quan den response format va response policy cua backend.
Use this skill when the task involves:

- unified API response shape
- success envelope
- error envelope
- controller response format
- centralized response serialization

# Rules

Skill nay chuan hoa tat ca response tra ve tu backend.
- All success responses should follow one stable envelope shape.
- All error responses should follow one stable envelope shape.
- Controllers should not invent ad-hoc response structures.
- Error responses should be serialized in one centralized error-handling layer.
- HTTP status codes must stay semantically correct.
- Error messages returned to clients should be safe and not overly revealing.

# Workflow

Doc reference theo dung loai response.
1. Read [references/success-envelope.md](references/success-envelope.md) when returning successful responses.
2. Read [references/error-envelope.md](references/error-envelope.md) when shaping error payloads.
3. Read [references/http-semantics.md](references/http-semantics.md) when choosing status codes.
4. Read [references/controller-response-boundary.md](references/controller-response-boundary.md) when deciding what controllers should send directly and what should be delegated.
5. Reuse [templates/response.js](templates/response.js) and [templates/responders.js](templates/responders.js) as the baseline.
6. Use [examples/controller-response.js](examples/controller-response.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-api-contract` for public contract rules
- `backend-controller-layer` for thin controller boundaries
- `backend-validation-layer` for boundary validation that throws on failure
- `backend-error-handling` for centralized error serialization

# Adaptation Notes

Phan nay giup response policy khop voi app frontend va security model.
- Keep envelope fields stable across all endpoints.
- Prefer concise public error messages and richer internal logs.
- If metadata is needed, keep it under a predictable top-level key such as `meta`.
