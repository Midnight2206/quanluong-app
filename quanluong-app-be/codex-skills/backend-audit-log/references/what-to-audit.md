# What To Audit

Khong phai moi action deu can audit.

## Good Fit

- create, update, delete on sensitive entities
- approval and rejection actions
- permission or role changes
- auth-relevant security events

## Usually Not Needed

- routine reads
- cosmetic preference changes unless policy requires them
- noisy background refresh events

## Guardrails

- Focus on meaningful business actions.
- Keep audit policy predictable across similar domains.
- Avoid turning audit storage into noisy analytics.
