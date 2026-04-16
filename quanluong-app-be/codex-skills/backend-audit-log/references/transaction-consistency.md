# Transaction Consistency

Neu audit la mot phan cua nghiep vu nhay cam, no nen di cung transaction.

## Good Practices

- write audit rows inside the same Prisma transaction when consistency matters
- make the audit insert explicit in the service flow
- keep external audit publishing separated when rollback semantics differ

## Guardrails

- Do not log success audit events for failed transactions.
- Keep transaction ownership in the service layer.
- Make consistency expectations explicit per use case.
