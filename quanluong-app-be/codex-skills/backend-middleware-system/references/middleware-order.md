# Middleware Order

Thu tu middleware rat quan trong trong Express app.

## Recommended Order

1. request context and tracing
2. cookie parsing or basic request parsing
3. auth middleware
4. permission middleware
5. validation middleware
6. controller
7. centralized error middleware

## Guardrails

- Do not run permission checks before authentication.
- Do not place error middleware before the main request pipeline.
- Keep route-level middleware chains readable.
