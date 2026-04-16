# Module Reuse Rules

Khong phai moi file tot deu nen dua vao `shared` ngay lap tuc.

## Prefer Local First

Keep code inside the module when it is:

- only used by one domain
- tightly coupled to one business vocabulary
- likely to evolve with that domain

## Promote To Shared When

- at least two modules reuse the same code
- the abstraction is stable enough to name clearly
- the code is infrastructure-oriented rather than domain-specific

## Examples

- keep `users-response.mapper.js` inside `users`
- move `buildPaginationMeta` to shared only after multiple modules need the same behavior
- keep `payroll-status.constants.js` inside `payroll`

## Guardrails

- Avoid premature abstraction.
- Shared code should reduce duplication, not hide domain meaning.
