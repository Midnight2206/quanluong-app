# Retry And Failure

Job failures can chinh sach ro rang.

## Good Practices

- configure retry count intentionally
- log or persist failure reasons safely
- avoid infinite retry loops
- separate permanent failures from transient failures

## Guardrails

- Do not silently lose failed jobs.
- Do not retry destructive or non-idempotent work blindly.
- Keep retry settings visible in queue setup.
