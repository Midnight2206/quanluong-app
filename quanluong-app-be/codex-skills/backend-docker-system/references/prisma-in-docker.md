# Prisma In Docker

Prisma can duoc chay trong Docker theo cach de team co the dong bo schema va migration on dinh.

## Preferred Practices

- keep `prisma/schema.prisma` in the repository
- commit migrations for team synchronization
- run `prisma generate` as part of dependency/runtime preparation
- run `prisma migrate deploy` in a controlled startup or release step

## Guardrails

- Do not hide schema changes outside Prisma migration flow.
- Do not rely on manual local DB drift.
- If startup migrations are used, make sure the workflow is explicit and safe for the environment.
