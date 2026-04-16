---
name: backend-api-contract
description: Build or refactor backend API contracts with stable route design, unified success and error response shapes, status code rules, pagination and filter params, and clear controller-level boundaries.
---

# Purpose

Dung skill nay khi task lien quan den HTTP contract, route design, hoac request-response shape cua backend.
Use this skill when the task involves:

- API route design
- request and response shape
- unified response envelope
- status codes
- pagination, filter, sort params
- controller response contracts

# Rules

Skill nay chi quan tam den contract o boundary cua backend.
- Keep API contracts explicit and predictable.
- Keep request parsing and response shaping at the controller boundary.
- Keep success and error response shapes consistent across endpoints.
- Use stable status-code rules across similar endpoints.
- Keep pagination, filter, and sort contracts consistent per resource type.
- Do not leak raw database models directly as public API responses.

# Workflow

Doc reference theo dung bai toan contract.
1. Read [references/route-design.md](references/route-design.md) when creating or refactoring endpoints.
2. Read [references/request-response-shape.md](references/request-response-shape.md) when defining payloads.
3. Read [references/status-codes.md](references/status-codes.md) when choosing HTTP responses.
4. Read [references/query-contract.md](references/query-contract.md) when handling pagination or filters.
5. Reuse [templates/controller-handler.js](templates/controller-handler.js) as the baseline.
6. Pair this skill with `backend-response-system` for unified success and error envelopes.
7. Use [examples/resource-controller.js](examples/resource-controller.js) as a reference.

# Adaptation Notes

Phan nay giup contract khop voi domain va framework.
- If the backend already has an API envelope pattern, preserve it consistently.
- Keep route names resource-oriented unless domain actions clearly require verbs.
- When backend contracts evolve, isolate versioning or translation at the contract layer.
