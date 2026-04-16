# Validation Error Flow

Validation fail khong nen tu tra response ngay trong middleware.

## Recommended Flow

1. Zod parses req body, query, or params
2. if parsing succeeds, attach `req.validatedBody`, `req.validatedQuery`, or `req.validatedParams`
3. if parsing fails, map the Zod error into an application error
4. forward the mapped error to centralized error middleware with `next(error)`

## Guardrails

- Do not swallow Zod parsing errors.
- Do not return ad-hoc validation payloads from many middleware files.
- Keep validation failures consistent with the shared error and response system.
