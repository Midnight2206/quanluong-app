# Migration Rules

Migration can ro rang de dong bo DB trong du an nhom.

## Required Rules

- every schema change must have a Prisma migration
- Prisma Migrate must read `DATABASE_URL` through `prisma.config.ts`
- commit migrations to version control
- keep migration names descriptive
- apply migrations consistently across environments

## Good Practices

- prefer small, focused migrations
- review generated SQL before applying in shared environments
- keep migration history linear and understandable when possible

## Guardrails

- Do not change production structure without a tracked migration.
- Do not let teammates recreate schema changes manually.
- Do not hide breaking schema changes inside unrelated commits.
