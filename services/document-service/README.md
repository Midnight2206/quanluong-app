# Document microservice

Internal FastAPI + openpyxl service for `.xlsx` parse/export. Node BE calls it on the Docker network; FE must not call directly.

## Environment

- **`DOCUMENT_SERVICE_KEY`** — required for `/v1/*`; send as header `X-Service-Key`.
- Node BE (see `quanluong-app-be/.env.example`): `DOCUMENT_SERVICE_URL=http://document:8000`, same key value.

## Local

```bash
cd services/document-service
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
export DOCUMENT_SERVICE_KEY=dev-key
uvicorn app.main:app --reload --port 8000
```

## Tests

```bash
cd services/document-service && . .venv/bin/activate && pytest -v
```

## Docker

Service `document` in root `docker-compose.yml` — internal only (no host port). `app` waits for `document` with `service_started`.

## curl (local :8000)

```bash
curl -s http://127.0.0.1:8000/health
curl -s -H "X-Service-Key: dev-key" -F "file=@sample.xlsx" http://127.0.0.1:8000/v1/parse
curl -s -o out.xlsx -H "X-Service-Key: dev-key" -H "Content-Type: application/json" \
  -d '{"sheet":"Sheet1","rows":[["Mã","Tên"],["A01","Gạo"]]}' http://127.0.0.1:8000/v1/export
```

`.xlsx` only; max upload 5 MB.
