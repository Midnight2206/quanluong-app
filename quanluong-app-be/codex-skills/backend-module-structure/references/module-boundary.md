# Module Boundary

Mot module dai dien cho mot business capability ro rang, khong phai mot tap hop file ngau nhien.

## Good Boundaries

- `users`
- `roles`
- `payroll`
- `attendance`
- `notifications`

## What Belongs Inside One Module

- route registration for that domain
- controller logic for HTTP request and response handling
- service logic for business orchestration
- validators for request parsing
- mappers for DTO or response shaping when needed
- module-local constants or helper functions

## What Should Stay Outside

- global middleware
- shared Prisma client setup
- global error classes
- generic response helpers
- infra code reused by many domains

## Guardrails

- Do not mix unrelated business capabilities in the same module.
- Do not create one giant `common` module for business logic.
- If a helper is reused by multiple modules, move it to a shared location intentionally.
