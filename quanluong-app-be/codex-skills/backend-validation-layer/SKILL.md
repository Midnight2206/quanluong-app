---
name: backend-validation-layer
description: Build or refactor backend request validation with Zod schemas, boundary-safe parsing of req body/query/params, normalized DTO shapes, and centralized validation failure handling in Node.js Express apps.
---

# Purpose

Dung skill nay khi task lien quan den validate input o backend.
Use this skill when the task involves:

- Zod schema validation
- request validation
- DTO or schema parsing
- req body, query, and params parsing
- input normalization
- boundary-safe data parsing
- validation middleware

# Rules

Skill nay so huu boundary validation voi `Zod`, khong so huu business logic.
- Default validation library for this backend is `Zod`.
- Validate input at the outer boundary before business logic runs.
- Validate `req.body`, `req.query`, and `req.params` with explicit Zod schemas.
- Normalize request data into stable DTO-like shapes before services consume it.
- Keep validation rules separate from repository or controller plumbing where possible.
- Use one schema source per request shape when practical.
- Do not duplicate the same field rules across many modules without a reason.
- Validation failures must throw to the centralized error-handling layer instead of returning ad-hoc responses directly.

# Workflow

Doc reference theo dung loai input.
1. Read [references/boundary-validation.md](references/boundary-validation.md) when deciding where validation should happen.
2. Read [references/zod-schema-patterns.md](references/zod-schema-patterns.md) when defining Zod schemas.
3. Read [references/schema-shape.md](references/schema-shape.md) when defining request schemas.
4. Read [references/normalization.md](references/normalization.md) when coercing or transforming request values.
5. Read [references/validation-error-flow.md](references/validation-error-flow.md) when connecting Zod failures to centralized error handling.
6. Reuse [templates/schema.js](templates/schema.js), [templates/validate-request.js](templates/validate-request.js), and [templates/map-zod-error.js](templates/map-zod-error.js) as the baseline.
7. Use [examples/create-user-validation.js](examples/create-user-validation.js) as a reference.

# Adaptation Notes

Phan nay giup validation layer khop voi framework va data contract.
- This backend standardizes on `Zod` for request validation.
- Keep normalization near validation so services receive trusted shapes.
- Reserve deeper business invariants for the service layer after basic boundary validation passes.
- Do not let validation middleware send custom error responses inline if the project centralizes error serialization.
