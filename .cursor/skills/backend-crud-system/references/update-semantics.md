# Update Semantics

PATCH va PUT phai duoc dung dung nghia.

## PATCH

- partial update
- only the provided fields are changed
- omitted fields stay unchanged

## PUT

- full replacement of the intended resource shape
- omitted fields are treated according to full-update rules

## Guardrails

- Do not use `PUT` for partial updates by habit.
- Do not make `PATCH` behave like a full replacement.
- Keep validation schemas different when PATCH and PUT semantics differ.
