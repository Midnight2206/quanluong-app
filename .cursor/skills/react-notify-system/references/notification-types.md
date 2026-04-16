# Notification Types

Tai lieu nay giup phan loai notification trong app.

## Use Toast For

- save success
- retryable mutation failure
- short warnings that do not need history

## Use Persistent Notifications For

- approvals or workflow events
- system announcements
- alerts that users may need to revisit
- messages shown from a bell menu or notification drawer

## Use Both Only When

- the user needs immediate awareness now and a persistent trail later

## Guardrails

- Do not turn every toast into a notification center item.
- Do not use persistent notifications for trivial one-off confirmations.
- Keep message urgency proportional to user impact.
