# Extraction Checklist

Dung checklist nay truoc khi de mot component tiep tuc phinh to.

## Ask These Questions

1. Is the file approaching or exceeding 500 lines?
2. Does the file contain more than one visual section with separate responsibilities?
3. Is any subview repeated in two or more places?
4. Can a nested block become a named component with a small prop API?
5. Should the extracted piece stay inside the feature, or has it become app-wide shared UI?

## Preferred Decision

- one feature only: keep it under `features/<name>/components`
- two or more features: promote it to shared `components/`
- repeated logic only: extract a hook or utility instead of a component
