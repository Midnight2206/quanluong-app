---
name: backend-audit-log
description: Guides building or refactoring a backend audit-log system for important business actions with actor tracking, entity references, safe payload logging, transaction-aware persistence, and reviewable event semantics.
---

# Purpose

Dung skill nay khi task lien quan den ghi nhat ky thao tac quan trong trong backend.
Use this skill when the task involves:

- audit log
- action history
- who-did-what tracking
- compliance-style event recording
- write-side traceability for sensitive actions

# Rules

Skill nay chuan hoa viec ghi audit cho action nghiep vu quan trong.
- Audit only meaningful actions, not every trivial read.
- Record actor, action, target entity, and timestamp.
- Keep audit payloads safe and intentionally scoped.
- Avoid logging secrets, tokens, raw passwords, or overly sensitive internals.
- If the audited action and DB write must stay consistent, persist audit data in the same transaction.
- Keep event names stable and human-reviewable.

# Workflow

Doc reference theo dung loai audit need.
1. Read [references/what-to-audit.md](references/what-to-audit.md) when deciding which actions deserve audit logs.
2. Read [references/event-shape.md](references/event-shape.md) when designing audit payloads.
3. Read [references/transaction-consistency.md](references/transaction-consistency.md) when audit persistence must match write success.
4. Read [references/safe-payloads.md](references/safe-payloads.md) when deciding what data is safe to store.
5. Reuse [templates/audit-service.js](templates/audit-service.js) and [templates/audit-event.js](templates/audit-event.js) as the baseline.
6. Use [examples/audited-update-flow.js](examples/audited-update-flow.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-db-layer` for Prisma persistence
- `backend-service-layer` for business-side audit orchestration
- `backend-auth-system` for actor identity
- `backend-error-handling` for safe failure mapping when audit logging is required

# Adaptation Notes

Phan nay giup audit log huu ich ma khong gay nhieu noise.
- Keep audit event names aligned with business actions, not implementation internals.
- Prefer storing references and safe summaries over entire mutable payloads.
- If the app has strict compliance needs, keep audit records append-only where possible.
