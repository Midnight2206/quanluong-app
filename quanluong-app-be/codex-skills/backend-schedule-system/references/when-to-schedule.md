# When To Schedule

Schedule chi phu hop voi tac vu chay theo thoi gian.

## Good Fit

- daily syncs
- monthly payroll runs
- expiration cleanup
- scheduled reminders
- routine reconciliation tasks

## Usually Better As Queue

- tasks triggered directly by a user action
- one-off asynchronous work that should start immediately after a request

## Guardrails

- Do not use schedules for request-bound business actions that should run immediately.
- Do not mix schedule decisions with generic queue decisions.
- Keep time-based automation explicit and reviewable.
