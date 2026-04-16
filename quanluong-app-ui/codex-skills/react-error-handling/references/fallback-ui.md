# Fallback UI

Fallback UI la man hinh thay the an toan khi mot khu vuc khong the render dung.

## Good Fit

- route-level error screens
- widget-level crash protection
- sections that depend on missing or invalid data

## Recommended Shape

- clear message
- retry action when meaningful
- safe way back to a stable screen

## Guardrails

- Keep fallback UI calm and focused.
- Do not leak raw stack traces to end users.
- Use the smallest useful boundary instead of wrapping the whole app blindly.
