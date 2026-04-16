# Worker Responsibility

Worker la noi xu ly background jobs, khong phai noi xu ly HTTP.

## Good Fit

- process queued payloads
- load fresh data
- perform heavy or delayed side effects
- record outcome or failure logs when needed

## Guardrails

- Workers do not return HTTP responses.
- Keep worker logic focused on the job it owns.
- Reuse shared services when business rules must stay consistent.
