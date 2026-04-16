# Request Response Boundary

Controller chi nen xu ly boundary HTTP, khong nen vuot qua boundary nay.

## Allowed Work

- read `req.validatedBody`, `req.validatedQuery`, or `req.validatedParams`
- pass a clean input object to the service
- choose `200`, `201`, `204`, or another response status
- return JSON output

## Avoid

- field-level validation logic repeated inside controller
- direct DTO persistence mapping
- manual transaction or query coordination

## Guardrails

- Keep input extraction shallow and readable.
- Keep response shaping simple and stable.
- Push domain-specific branching into services.
