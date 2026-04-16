# Boundary Validation

Validation nen xay ra som nhat o boundary tiep nhan request.

## Good Practices

- validate body, query, and params before calling services
- attach parsed values to request context when useful
- fail fast on malformed input

## Guardrails

- Do not let services parse raw HTTP payloads repeatedly.
- Do not rely on database errors for basic input validation.
- Keep validation centralized per route or request shape.
