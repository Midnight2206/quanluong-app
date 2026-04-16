# Transactions

Tat ca nghiep vu DB phuc tap deu phai co transaction ro rang.

## Good Fit For Transactions

- many related writes that must succeed together
- create parent and child records in one use case
- update balances, status, and audit rows together
- workflows where partial success would corrupt business state

## Good Practices

- use Prisma transaction APIs
- keep transactional steps explicit and close to the use case
- separate non-transactional external side effects when rollback semantics differ

## Guardrails

- Do not let complex multi-step writes run without a transaction.
- Do not scatter transaction ownership across many helpers.
- Keep transaction boundaries visible in service methods.
