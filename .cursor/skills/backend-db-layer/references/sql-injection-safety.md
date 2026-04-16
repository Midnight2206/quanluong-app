# SQL Injection Safety

Project nay phai ngan chan tuyet doi SQL injection.

## Required Rules

- prefer Prisma query APIs over raw SQL
- never concatenate untrusted strings into SQL
- when raw SQL is unavoidable, use safe parameterized Prisma mechanisms only

## Good Practices

- validate and normalize user input before query building
- restrict dynamic sort or filter fields to known allowlists
- keep raw SQL isolated and heavily reviewed

## Guardrails

- Do not use string interpolation for raw SQL from request input.
- Do not pass unchecked column names or order strings into raw queries.
- Treat all user-controlled input as unsafe by default.
