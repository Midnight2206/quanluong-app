# Idempotency And Retries

Tac vu theo lich can tinh den viec chay lai hoac chay trung.

## Good Practices

- design recurring jobs to be idempotent when possible
- detect already-processed windows or periods
- make retries explicit and safe

## Guardrails

- Do not assume a scheduled task runs exactly once forever.
- Do not let retries duplicate destructive side effects blindly.
- Keep period or execution keys visible in code.
