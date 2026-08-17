# Excel microservice final review fixes

Date: 2026-08-16
Branch: `feat/excel-microservice`

## Fixed

- Backend Compose dependency now waits only for the Excel container to start; the Excel healthcheck remains enabled for monitoring.
- Upstream Excel authentication failures (`401`/`403`) map to `502` with a generic Vietnamese message; upstream `400` remains a client error with its service message.
- Workbook parsing runs through Starlette's threadpool instead of blocking the async event loop.
- FastAPI request validation failures return HTTP `400` with the standard `BAD_REQUEST` error envelope.
- Parse uploads use a strict `.xlsx` filename allowlist.
- Export response body read failures map to a generic `502` `AppError`.

## Verification

- `cd services/excel-service && .venv/bin/pytest -v` — 12 passed.
- `cd quanluong-app-be && node --test src/services/excel-service.client.test.js` — 10 passed.
- `docker compose --env-file quanluong-app-be/.env.docker config --quiet` — passed.
- IDE lint diagnostics for changed Python and JavaScript files — clean.
