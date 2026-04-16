# Cache Boundary

Cache la lop tang toc, khong phai source of truth.

## Good Cache Candidates

- read-heavy list endpoints
- detail lookups accessed frequently
- lookup tables and reference data
- expensive derived or aggregated reads

## Bad Cache Candidates

- highly sensitive secrets
- data that must always be perfectly fresh
- short-lived one-off values with no reuse
- business flows where stale reads create serious correctness risk

## Guardrails

- Keep cache decisions inside services or dedicated cache helpers.
- Do not put cache policy in controllers.
- When in doubt, prefer correctness over caching.
