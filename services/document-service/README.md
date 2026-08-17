# Document microservice (P1)

Internal FastAPI: `.xlsx` parse/export, Postgres template schema, Pagination Engine (`end_bias`, 18–28pt). Node BE only.

Docs: [design](../../docs/superpowers/specs/2026-08-17-document-service-p1-design.md) · [plan](../../docs/superpowers/plans/2026-08-17-document-service-p1.md)

## P1 scope

**In:** `/health`, `/v1/parse`, `/v1/export`, `POST /v1/pagination/plan`, `GET /v1/templates`. **Out:** PDF, MinIO, importer, document-create.

## Environment

`DOCUMENT_SERVICE_KEY` (header `X-Service-Key`), `DOCUMENT_DATABASE_URL` (`postgresql+psycopg://…`, optional locally). Node: `DOCUMENT_SERVICE_URL`, `DOCUMENT_SERVICE_KEY`, `DOCUMENT_SERVICE_TIMEOUT_MS` — see `quanluong-app-be/.env.example`.

## Local

```bash
cd services/document-service && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
export DOCUMENT_SERVICE_KEY=dev-key DOCUMENT_DATABASE_URL=postgresql+psycopg://document:document@127.0.0.1:5432/document
alembic upgrade head && uvicorn app.main:app --reload --port 8000
pytest -v   # test_page_planner, test_pagination_api, test_api, test_templates
```

Docker: `document` + `document-db` (Postgres 16); entrypoint runs migrations. No host port; `app` depends on `document` (`service_started`).

## curl (:8000)

```bash
curl -s http://127.0.0.1:8000/health
curl -s -H "X-Service-Key: dev-key" -F "file=@sample.xlsx" http://127.0.0.1:8000/v1/parse
curl -s -o out.xlsx -H "X-Service-Key: dev-key" -H "Content-Type: application/json" \
  -d '{"sheet":"Sheet1","rows":[["Mã","Tên"],["A01","Gạo"]]}' http://127.0.0.1:8000/v1/export
curl -s -H "X-Service-Key: dev-key" -H "Content-Type: application/json" -d '{"n_rows":3,"page_content_height":200,"header_height":20,"signature_block_height":40}' http://127.0.0.1:8000/v1/pagination/plan
curl -s -H "X-Service-Key: dev-key" http://127.0.0.1:8000/v1/templates
```

`.xlsx` only; max upload 5 MB.
