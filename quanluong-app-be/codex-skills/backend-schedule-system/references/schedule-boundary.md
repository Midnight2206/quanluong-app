# Schedule Boundary

Schedule la noi phat trigger theo thoi gian, khong phai noi chua toan bo nghiep vu.

## Recommended Responsibilities

- declare the schedule
- identify the target service or queue job
- trigger the work
- log or surface the execution result appropriately

## Guardrails

- Keep schedule callbacks thin.
- Move business logic to services.
- Move heavy processing to queue workers when appropriate.
