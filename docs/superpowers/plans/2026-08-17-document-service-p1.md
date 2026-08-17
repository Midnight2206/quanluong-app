# Document Service P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `excel-service` → `document-service`, keep parse/export, add PostgreSQL schema + pure Pagination Engine (`end_bias`, 18–28pt, min 2 rows on last page) with HTTP `/v1/pagination/plan` and stub `GET /v1/templates` — no PDF/MinIO/importer.

**Architecture:** FastAPI service absorbs Excel helpers; new `app/pagination/page_planner.py` is pure and unit-tested. Alembic migrates four tables on Postgres `document-db`. Node BE switches to `DOCUMENT_SERVICE_*` env and renamed client.

**Tech Stack:** FastAPI, openpyxl (existing), SQLAlchemy 2 + Alembic + psycopg, pytest, Docker Compose Postgres 16, Node `fetch` client.

**Spec:** `docs/superpowers/specs/2026-08-17-document-service-p1-design.md`

## Global Constraints

- P1 only: no ReportLab, MinIO, Template Importer, document-create PDF API.
- Rename: `services/excel-service` → `services/document-service`; compose service `document` (not `excel`).
- Keep `/v1/parse`, `/v1/export`; health returns `service: "document"`.
- Auth header `X-Service-Key` = `DOCUMENT_SERVICE_KEY`.
- Pagination: `row_height_min=18`, `row_height_max=28`, `min_rows_last_page=2`, `stretch_strategy=end_bias`.
- Node: đổi hẳn `EXCEL_SERVICE_*` → `DOCUMENT_SERVICE_*`.
- Compose: `app.depends_on.document: service_started` (not service_healthy gate).
- Error envelope `{ "error": { "code", "message" } }` giữ như hiện tại.
- YAGNI: không abstraction ngoài file map.

## File map

| File | Role |
|------|------|
| `services/document-service/**` | Renamed from excel-service |
| `services/document-service/app/pagination/page_planner.py` | Pure planner |
| `services/document-service/tests/test_page_planner.py` | Unit tests algorithm |
| `services/document-service/app/db.py` | SQLAlchemy engine/session |
| `services/document-service/app/models.py` | ORM models |
| `services/document-service/alembic/` | Migrations |
| `services/document-service/app/main.py` | Routes: health, parse, export, pagination, templates |
| `docker-compose.yml` | `document-db` + `document`; remove `excel` |
| `quanluong-app-be/src/services/document-service.client.js` | Renamed client |
| `quanluong-app-be/src/config/env.js` + `config.js` | DOCUMENT_* |
| `.env.example` / `.env.docker.example` | Document vars; deprecate EXCEL_* |

---

### Task 1: Rename excel-service → document-service

**Files:**
- Rename directory: `services/excel-service` → `services/document-service` (`git mv`)
- Modify: `services/document-service/app/auth.py` — read `DOCUMENT_SERVICE_KEY`
- Modify: `services/document-service/app/main.py` — health `service: "document"`
- Modify: `services/document-service/tests/test_api.py` — env `DOCUMENT_SERVICE_KEY`
- Modify: `services/document-service/README.md` — names/URLs
- Modify: `docker-compose.yml` — replace `excel` block with `document` (still no Postgres in this task; keep build working)
- Modify: `app` `depends_on` if it references `excel` → `document` with `service_started`

**Interfaces:**
- Produces: service runs with `DOCUMENT_SERVICE_KEY`; image name `quanluong-document:latest`, hostname `document:8000`

- [ ] **Step 1: git mv and update key/health strings**

```bash
git mv services/excel-service services/document-service
```

In `auth.py`, replace `EXCEL_SERVICE_KEY` with `DOCUMENT_SERVICE_KEY`.  
In `main.py` health: `return {"ok": True, "service": "document"}`.  
In tests: `os.environ["DOCUMENT_SERVICE_KEY"] = "test-key"`.

- [ ] **Step 2: Update compose service name**

Replace `excel:` service with:

```yaml
  document:
    build:
      context: ./services/document-service
    image: quanluong-document:latest
    container_name: quanluong-document
    restart: unless-stopped
    environment:
      DOCUMENT_SERVICE_KEY: ${DOCUMENT_SERVICE_KEY:-dev-document-key-change-me}
    healthcheck:
      test:
        [
          "CMD",
          "python",
          "-c",
          "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health').read()",
        ]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 10s
```

On `app.depends_on`, use `document: condition: service_started` (remove excel if present).

- [ ] **Step 3: Run Python tests**

```bash
cd services/document-service && . .venv/bin/activate 2>/dev/null || (python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt)
pytest -v
```

Expected: all existing tests PASS (update any EXCEL_ env leftovers).

- [ ] **Step 4: Commit**

```bash
git add -A services/document-service docker-compose.yml
# do not stage .venv
git commit -m "$(cat <<'EOF'
refactor: rename excel-service to document-service

EOF
)"
```

---

### Task 2: Pagination Engine (pure, TDD)

**Files:**
- Create: `services/document-service/app/pagination/__init__.py`
- Create: `services/document-service/app/pagination/page_planner.py`
- Create: `services/document-service/tests/test_page_planner.py`

**Interfaces:**
- Produces:
  - `@dataclass PagePlan` / `PaginationResult` as in spec
  - `plan_pages(*, n_rows, page_content_height, header_height=0, carry_row_height=0, signature_block_height=0, row_height_min=18, row_height_max=28, min_rows_last_page=2, stretch_strategy="end_bias") -> PaginationResult`
  - Raises `ValueError` with Vietnamese message if infeasible

**Algorithm notes (implement exactly):**
1. Available height for data rows on a non-last page ≈ `page_content_height - header_height - (carry_row_height if has_carry_from_prev else 0) - (carry_row_height if will_have_next else 0)` — simpler P1 model: every page reserves `header_height`; pages after the first reserve `carry_row_height` for “cộng mang sang”; non-last pages also reserve `carry_row_height` for “cộng chuyển”; **last page** reserves `signature_block_height` instead of outgoing carry.
2. Greedy pack with uniform `h` starting at `row_height_min`.
3. If last page has `0 < len(rows) < min_rows_last_page` (and total rows ≥ min_rows_last_page): bump heights using **end_bias** — increase height of the last K packed rows on earlier pages (or increase global trial `h` preferentially affecting how many rows fit near the end) within [min,max], re-pack, until last page has ≥2 data rows or raise.
4. Practical P1 end_bias: binary/search or step `h` from min to max by 0.5pt; for each candidate uniform height, pack; among feasible plans prefer smallest `h` that satisfies last-page rule; if only non-uniform stretch needed, after finding a near-feasible pack, add leftover vertical space on the last page’s preceding page to the **last** data rows of that page (end of that page) up to max.

Keep implementation small: **uniform height search** first (end_bias documented as preference when distributing leftover stretch on the page before last / last rows). If uniform height in [18,28] can satisfy last-page rule, use it. If not, raise Vietnamese `ValueError`.

- [ ] **Step 1: Failing tests**

```python
# tests/test_page_planner.py
import pytest
from app.pagination.page_planner import plan_pages

def test_single_page_all_rows():
    r = plan_pages(
        n_rows=3,
        page_content_height=200,
        header_height=20,
        signature_block_height=40,
        row_height_min=18,
        row_height_max=28,
    )
    assert len(r.pages) == 1
    assert r.pages[0].row_indices == [0, 1, 2]
    assert r.pages[0].is_last is True
    assert all(18 <= h <= 28 for h in r.pages[0].row_heights)


def test_last_page_at_least_two_rows():
    # Force multi-page with content height that would leave 1 on last at min height
    r = plan_pages(
        n_rows=5,
        page_content_height=80,  # tune so naive min-height leaves 1 on last
        header_height=10,
        carry_row_height=10,
        signature_block_height=20,
        row_height_min=18,
        row_height_max=28,
        min_rows_last_page=2,
    )
    assert r.pages[-1].is_last
    assert len(r.pages[-1].row_indices) >= 2


def test_infeasible_raises():
    with pytest.raises(ValueError, match="không"):
        plan_pages(
            n_rows=50,
            page_content_height=40,
            header_height=30,
            signature_block_height=20,
            row_height_min=18,
            row_height_max=28,
        )
```

Tune numbers in tests after first RED so they match the chosen packing model; document chosen numbers in comments.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/document-service && . .venv/bin/activate && pytest tests/test_page_planner.py -v
```

- [ ] **Step 3: Implement `page_planner.py`**

Dataclasses + `plan_pages` as above. Export from `app/pagination/__init__.py`.

- [ ] **Step 4: Run — expect PASS**

```bash
cd services/document-service && . .venv/bin/activate && pytest tests/test_page_planner.py -v
```

- [ ] **Step 5: Commit**

```bash
git add services/document-service/app/pagination services/document-service/tests/test_page_planner.py
git commit -m "$(cat <<'EOF'
feat(document-service): add pure pagination planner with end_bias tests

EOF
)"
```

---

### Task 3: HTTP `POST /v1/pagination/plan`

**Files:**
- Modify: `services/document-service/app/main.py`
- Create: `services/document-service/tests/test_pagination_api.py`

**Interfaces:**
- Body JSON:

```json
{
  "n_rows": 5,
  "page_content_height": 200,
  "header_height": 20,
  "carry_row_height": 10,
  "signature_block_height": 40,
  "row_height_min": 18,
  "row_height_max": 28,
  "min_rows_last_page": 2,
  "stretch_strategy": "end_bias"
}
```

- Response: JSON serialization of `PaginationResult` (pages as list of dicts).
- Auth: `Depends(require_service_key)`.
- `ValueError` → 400 envelope.

- [ ] **Step 1: Failing API test**

```python
import os
os.environ["DOCUMENT_SERVICE_KEY"] = "test-key"
from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)

def test_pagination_plan_ok():
    r = client.post(
        "/v1/pagination/plan",
        headers={"X-Service-Key": "test-key"},
        json={"n_rows": 3, "page_content_height": 200, "header_height": 20, "signature_block_height": 40},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["strategy"] == "end_bias"
    assert len(body["pages"]) >= 1
```

- [ ] **Step 2: Implement route + Pydantic model; run pytest**

- [ ] **Step 3: Commit**

```bash
git commit -am "$(cat <<'EOF'
feat(document-service): expose POST /v1/pagination/plan

EOF
)"
```

---

### Task 4: Postgres + Alembic schema + `GET /v1/templates`

**Files:**
- Modify: `services/document-service/requirements.txt` — add `sqlalchemy>=2,<3`, `alembic>=1.14,<2`, `psycopg[binary]>=3,<4`
- Create: `app/db.py`, `app/models.py`, `alembic.ini`, `alembic/env.py`, first revision
- Modify: `app/main.py` — `GET /v1/templates`
- Modify: `Dockerfile` — run migrations on start **or** document one-shot migrate; prefer CMD that runs `alembic upgrade head && uvicorn ...`
- Modify: `docker-compose.yml` — add `document-db`; wire `DOCUMENT_DATABASE_URL`

**Schema (SQLAlchemy models matching spec):**
- `templates`, `template_fields`, `template_table_config`, `documents` as specified; defaults 18/28/2/`end_bias` on table_config.

**`GET /v1/templates`:** return `[{id, name, version, ...}]` (empty list OK). If DB unreachable → 502 with error envelope.

- [ ] **Step 1: Add deps + models + Alembic migration** (create revision that creates all four tables)

- [ ] **Step 2: Compose Postgres**

```yaml
  document-db:
    image: postgres:16-alpine
    container_name: quanluong-document-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DOCUMENT_DB_USER:-document}
      POSTGRES_PASSWORD: ${DOCUMENT_DB_PASSWORD:-document}
      POSTGRES_DB: ${DOCUMENT_DB_NAME:-document}
    volumes:
      - document_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DOCUMENT_DB_USER:-document} -d ${DOCUMENT_DB_NAME:-document}"]
      interval: 10s
      timeout: 5s
      retries: 10

  document:
    # ...
    environment:
      DOCUMENT_SERVICE_KEY: ${DOCUMENT_SERVICE_KEY:-dev-document-key-change-me}
      DOCUMENT_DATABASE_URL: postgresql+psycopg://${DOCUMENT_DB_USER:-document}:${DOCUMENT_DB_PASSWORD:-document}@document-db:5432/${DOCUMENT_DB_NAME:-document}
    depends_on:
      document-db:
        condition: service_healthy
```

Add volume `document_pg_data`. Do **not** publish Postgres port by default (or publish `5433:5432` only if needed for local debug — prefer no host port).

- [ ] **Step 3: Templates route + API test** (can mock session or skip if no DB in unit CI — prefer TestClient with SQLite **only if** URL override; else mark integration. Minimal: unit-test models import; API test skips without `DOCUMENT_DATABASE_URL`.)

Prefer: if `DOCUMENT_DATABASE_URL` unset, `GET /v1/templates` returns `[]` without error (P1 convenience for local pytest without Postgres). If set, query DB.

- [ ] **Step 4: Commit**

```bash
git commit -am "$(cat <<'EOF'
feat(document-service): add Postgres schema and GET /v1/templates

EOF
)"
```

---

### Task 5: Node client → DOCUMENT_SERVICE_*

**Files:**
- `git mv` `excel-service.client.js` → `document-service.client.js` (+ test file)
- Modify: `env.js`, `config.js` — `documentServiceUrl/Key/timeoutMs` from `DOCUMENT_SERVICE_*`
- Modify: `.env.example`, `.env.docker.example` — DOCUMENT_*; comment EXCEL_* deprecated
- Grep and fix any imports of excel client

**Interfaces:**
- `parseWorkbook`, `exportWorkbook` unchanged signatures
- Optional: `planPagination(body)` → POST `/v1/pagination/plan`
- Messages: «Document service chưa cấu hình (DOCUMENT_SERVICE_URL)»

- [ ] **Step 1: Update env/config + rename client; fix tests to DOCUMENT_***

- [ ] **Step 2: Run**

```bash
cd quanluong-app-be && node --test src/services/document-service.client.test.js
```

Expected: PASS (same coverage as excel client + one planPagination mock optional).

- [ ] **Step 3: Commit**

```bash
git commit -am "$(cat <<'EOF'
feat(be): switch Excel client to DOCUMENT_SERVICE_* document client

EOF
)"
```

---

### Task 6: README + spec pointer

**Files:**
- Update: `services/document-service/README.md` — P1 scope, env, alembic, pagination curl
- Ensure design/plan docs paths referenced

- [ ] **Step 1: Write README ≤50 lines**

- [ ] **Step 2: Commit**

```bash
git commit -am "$(cat <<'EOF'
docs(document-service): document P1 rename, DB, and pagination API

EOF
)"
```

---

## Plan self-review

1. **Spec coverage:** rename, parse/export keep, Postgres schema, pagination engine+HTTP, templates list, Node DOCUMENT_*, compose service_started — tasked. No PDF/MinIO/importer.
2. **Placeholders:** none intentional; test height numbers may need tuning in Task 2 Step 1 comments.
3. **Types:** `plan_pages` / `PaginationResult` consistent across Tasks 2–3; Node env names match compose.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-17-document-service-p1.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
**2. Inline Execution** — run tasks in this session with checkpoints  

Which approach?
