# Prisma Schema

Tat ca cau truc DB trong project nay phai duoc dinh nghia trong Prisma schema.

## Required Rules

- define models in `prisma/schema.prisma`
- keep datasource `provider` in schema, but move connection URL config to `prisma.config.ts`
- declare relations explicitly
- keep field names and constraints readable
- keep enums and defaults inside schema when they belong to the data model

## Good Practices

- use meaningful model names
- keep timestamps and status fields consistent across related models
- express indexes and unique constraints in Prisma schema

## Guardrails

- Do not create database structures manually outside Prisma schema.
- Do not put datasource `url` back into `schema.prisma` on Prisma 7.
- Do not let real DB drift away from committed schema.
- Keep schema changes reviewable and intentional.
