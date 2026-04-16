# Security Safe Messages

Public error message can du thong tin de dung, nhung khong duoc qua ro rang.

## Good Practices

- keep public messages concise
- avoid exposing internal table names, stack traces, SQL fragments, or auth internals
- use machine-readable error codes for frontend logic instead of overly specific text

## Examples

- good: `Request could not be completed.`
- good: `Invalid request data.`
- risky: `Email does not exist in users table.`
- risky: `Prisma transaction failed on payroll_run foreign key step 2.`

## Guardrails

- Do not expose system internals in public response messages.
- Use server-side logging for richer diagnostics.
- Prefer generic messages for unknown or security-sensitive failures.
