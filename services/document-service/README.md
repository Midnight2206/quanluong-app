# Document microservice (P1 + P2 + P3 + P4)

Internal FastAPI: `.xlsx` parse/export, Postgres template schema, Pagination Engine (`end_bias`, 18–28pt). P2 adds ReportLab PDF renderer (module only). P3 adds `.xlsx` template importer → `TemplateMetadata` + DB persist (module only). P4 exposes HTTP upload + PDF-from-DB routes. Node BE only.

Docs: [P1 design](../../docs/superpowers/specs/2026-08-17-document-service-p1-design.md) · [P1 plan](../../docs/superpowers/plans/2026-08-17-document-service-p1.md) · [P2 design](../../docs/superpowers/specs/2026-08-17-document-service-p2-design.md) · [P3 design](../../docs/superpowers/specs/2026-08-17-document-service-p3-design.md) · [P4 design](../../docs/superpowers/specs/2026-08-17-document-service-p4-design.md)

## P1 scope

**In:** `/health`, `/v1/parse`, `/v1/export`, `POST /v1/pagination/plan`, `GET /v1/templates`. **Out:** MinIO, Node client, FE.

## P2 scope

**In:** `render_demo_pdf(fields, rows) -> bytes` — synthetic demo template (fields + 5-col table + pagination via P1 planner). Fonts bundled in `fonts/` (`DejaVuSans.ttf`, `DejaVuSans-Bold.ttf`); registered on import via `app/render/fonts.py`. **Out:** HTTP PDF endpoint (no new routes in `main.py`).

```python
from app.render import render_demo_pdf
pdf = render_demo_pdf(fields={"don_vi": "…", "ngay_thang": "…", ...}, rows=[{"stt": "1", "ten_hang": "…", ...}])
```

Run PDF tests: `pytest tests/test_pdf_renderer.py -v` (pypdf page count + Vietnamese text). Full suite: `pytest -v`.

## P3 scope

**In:** `TemplateMetadata` (`app/template/metadata.py`) — shared contract for importer ↔ renderer. `parse_template(xlsx_bytes, name, version)` reads Named Ranges → metadata. `import_template(session, …)` persists to Postgres via `NullBlobStore` (`file_path = null`). `render_pdf(metadata, …)` replaces hardcoded demo layout; `render_demo_pdf()` kept as P2 wrapper.

| Named Range | Role |
|-------------|------|
| `FIELD_<name>` | Single field cell; `<name>` → snake_case `field_name` |
| `TABLE_HEADER` | Header row → column defs (required) |
| `TABLE_DATA_ROW` | Sample data row → row style (required; same sheet + column layout as header) |
| `TABLE_SIGNATURE` | Signature block start (optional; default 80pt height) |

**Out:** HTTP template upload, MinIO, `required_fields` enforcement — no new routes in `main.py`.

```python
import importlib

parse_template = importlib.import_module("app.import.template_importer").parse_template
import_template = importlib.import_module("app.import.template_service").import_template

metadata = parse_template(xlsx_bytes, name="bien_ban", version="1")
template_id = import_template(
    session, name="bien_ban", version="1", xlsx_bytes=xlsx_bytes
)
```

P3 tests: `test_template_metadata`, `test_template_importer`, `test_template_service`, `test_excel_coords`, `test_blob`. Minimal `.xlsx` inputs are built by the `make_minimal_template` factory in `tests/conftest.py`.

## P4 scope

**In:** HTTP upload + PDF from DB metadata (renderer never opens `.xlsx` on render).

| Route | Description |
|-------|-------------|
| `POST /v1/templates` | Multipart: `file` (`.xlsx`, max 5 MB), `name`, `version` → **201** `{ id, name, version, file_path: null }` |
| `GET /v1/templates/{id}` | Template detail (+ `created_at`) |
| `GET /v1/templates/{id}/fields` | `{ fields: [{ field_name, cell_ref }], columns: [{ key, title, align_h }] }` |
| `POST /v1/templates/{id}/documents` | JSON `{ fields, rows }` → **200** `application/pdf` |

**Identity:** `(name, version)` unique (Postgres index + pre-check). Duplicate → **400** `TEMPLATE_EXISTS`.

**Documents:** PDF bytes only — **no** insert into `documents` table.

**Out:** MinIO, Node client, FE, `required_fields` enforcement, pdfplumber QA.

## Environment

`DOCUMENT_SERVICE_KEY` (header `X-Service-Key`), `DOCUMENT_DATABASE_URL` (`postgresql+psycopg://…`, optional locally). Node: `DOCUMENT_SERVICE_URL`, `DOCUMENT_SERVICE_KEY`, `DOCUMENT_SERVICE_TIMEOUT_MS` — see `quanluong-app-be/.env.example`.

## Local

```bash
cd services/document-service && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
export DOCUMENT_SERVICE_KEY=dev-key DOCUMENT_DATABASE_URL=postgresql+psycopg://document:document@127.0.0.1:5432/document
alembic upgrade head && uvicorn app.main:app --reload --port 8000
pytest -v   # P1 + P2 + P3 + P4
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

# P4 — upload template
curl -s -H "X-Service-Key: dev-key" -F "file=@template.xlsx" -F "name=Phiếu nhập" -F "version=1" \
  http://127.0.0.1:8000/v1/templates

# P4 — template detail + form fields
curl -s -H "X-Service-Key: dev-key" http://127.0.0.1:8000/v1/templates/1
curl -s -H "X-Service-Key: dev-key" http://127.0.0.1:8000/v1/templates/1/fields

# P4 — render PDF (not persisted)
curl -s -o doc.pdf -H "X-Service-Key: dev-key" -H "Content-Type: application/json" \
  -d '{"fields":{"don_vi":"Đơn vị A","ngay_thang":"17/08/2026"},"rows":[{"stt":"1","ten_hang":"Gạo","dvt":"kg","so_luong":"10","ghi_chu":""}]}' \
  http://127.0.0.1:8000/v1/templates/1/documents
```

`.xlsx` only; max upload 5 MB.
