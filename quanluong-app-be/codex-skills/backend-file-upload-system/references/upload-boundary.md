# Upload Boundary

Upload la boundary dac biet vi request mang du lieu nhi phan va du lieu khong dang tin.

## What Belongs Here

- multipart parsing
- file size and type checks
- temporary storage or buffering
- storage handoff

## Guardrails

- Do not let controllers parse multipart content manually.
- Keep upload middleware and storage helpers explicit.
