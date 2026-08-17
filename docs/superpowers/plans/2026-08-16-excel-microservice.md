# Excel Microservice (Python) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a FastAPI Excel microservice (`services/excel-service/`) with `/health`, `/v1/parse`, `/v1/export`, wire it into Docker Compose (no host port), and add a thin Node BE client — no business module migration.

**Architecture:** Python FastAPI + openpyxl runs as internal Docker service `excel:8000`. Node BE calls it with `X-Service-Key`. Parse/export are pure helpers unit-tested without HTTP; routes are thin wrappers. Node client maps HTTP errors to `AppError` and no-ops clearly when URL empty.

**Tech Stack:** FastAPI, Uvicorn, openpyxl, pytest (or unittest), Docker Compose, Node `fetch`, existing `AppError` / `ERROR_CODES`.

**Spec:** `docs/superpowers/specs/2026-08-16-excel-microservice-design.md`

## Global Constraints

- MVP = khung only: health + parse + export; **no** LTTP/meal-roster/kitchen migration.
- FE must not call Excel service; HTTP nội bộ only.
- Auth: header `X-Service-Key` = `EXCEL_SERVICE_KEY` on all routes except `/health`.
- `.xlsx` only; max upload **5 MB**; reject `.xls`.
- No pandas, queue, fill-template, multi-sheet export, style/merge in this phase.
- Do not publish `excel` host ports by default.
- `EXCEL_SERVICE_URL` empty → client reports not configured (no hang).
- YAGNI: smallest files that work; no abstractions beyond plan file map.

## File map

| File | Role |
|------|------|
| `services/excel-service/requirements.txt` | fastapi, uvicorn, openpyxl, pytest, httpx (TestClient) |
| `services/excel-service/Dockerfile` | slim Python image, uvicorn |
| `services/excel-service/app/__init__.py` | package |
| `services/excel-service/app/auth.py` | service-key dependency |
| `services/excel-service/app/errors.py` | JSON error helpers |
| `services/excel-service/app/parse.py` | pure parse bytes → dict |
| `services/excel-service/app/export.py` | pure rows → xlsx bytes |
| `services/excel-service/app/main.py` | FastAPI routes |
| `services/excel-service/tests/test_parse_export.py` | round-trip + edge cases |
| `services/excel-service/tests/test_api.py` | health, auth, parse/export HTTP |
| `docker-compose.yml` | `excel` service + `app` depends_on |
| `quanluong-app-be/src/config/env.js` + `config.js` | excelService url/key/timeout |
| `quanluong-app-be/.env.example` + `.env.docker.example` | document env |
| `quanluong-app-be/src/services/excel-service.client.js` | Node client |
| `quanluong-app-be/src/services/excel-service.client.test.js` | mock fetch tests |

---

### Task 1: Pure parse + export (TDD)

**Files:**
- Create: `services/excel-service/requirements.txt`
- Create: `services/excel-service/app/__init__.py`
- Create: `services/excel-service/app/parse.py`
- Create: `services/excel-service/app/export.py`
- Create: `services/excel-service/tests/test_parse_export.py`

**Interfaces:**
- Produces:
  - `parse_xlsx(data: bytes, sheet: str | None = None) -> dict` with keys `sheet`, `sheets`, `rows` where each row is `{ "r": int, "c": list }` (1-based row index; empty cell → `None`)
  - `export_xlsx(sheet: str, rows: list[list]) -> bytes`
  - Raises `ValueError` with Vietnamese message for bad input (empty workbook, missing sheet, empty rows, non-2D rows)

- [ ] **Step 1: Write failing tests**

```python
# services/excel-service/tests/test_parse_export.py
from io import BytesIO

import pytest
from openpyxl import Workbook

from app.export import export_xlsx
from app.parse import parse_xlsx


def _xlsx_bytes(rows, sheet="Sheet1"):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_parse_simple():
    data = _xlsx_bytes([["Mã", "Tên"], ["A01", "Gạo"]])
    out = parse_xlsx(data)
    assert out["sheet"] == "Sheet1"
    assert out["sheets"] == ["Sheet1"]
    assert out["rows"][0] == {"r": 1, "c": ["Mã", "Tên"]}
    assert out["rows"][1]["c"][0] == "A01"


def test_export_round_trip():
    raw = export_xlsx("Data", [["A", "B"], [1, None]])
    out = parse_xlsx(raw, sheet="Data")
    assert out["sheet"] == "Data"
    assert out["rows"][0]["c"] == ["A", "B"]
    assert out["rows"][1]["c"][1] is None


def test_missing_sheet_raises():
    data = _xlsx_bytes([["x"]])
    with pytest.raises(ValueError, match="sheet"):
        parse_xlsx(data, sheet="Nope")


def test_export_empty_rows_raises():
    with pytest.raises(ValueError):
        export_xlsx("S", [])
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/excel-service && python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
# first create minimal requirements.txt with openpyxl pytest
pytest tests/test_parse_export.py -v
```

Expected: FAIL (modules missing) or import error.

- [ ] **Step 3: Implement parse + export**

`parse.py`: load with `openpyxl.load_workbook(BytesIO(data), data_only=True)`; pick sheet; iterate `ws.iter_rows(values_only=True)`; trim trailing all-null rows; pad each row to max width of used range; convert empty → `None`.

`export.py`: create workbook, rename active sheet, append rows (reject if not `list` of `list`/`tuple` with len≥1), save to `BytesIO`.

`requirements.txt`:

```
fastapi>=0.115,<1
uvicorn[standard]>=0.32,<1
openpyxl>=3.1,<4
pytest>=8,<9
httpx>=0.27,<1
python-multipart>=0.0.9
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd services/excel-service && . .venv/bin/activate && pytest tests/test_parse_export.py -v
```

- [ ] **Step 5: Commit**

```bash
git add services/excel-service/
git commit -m "$(cat <<'EOF'
feat(excel-service): add pure parse/export helpers with tests

EOF
)"
```

---

### Task 2: FastAPI routes + auth

**Files:**
- Create: `services/excel-service/app/auth.py`
- Create: `services/excel-service/app/errors.py`
- Create: `services/excel-service/app/main.py`
- Create: `services/excel-service/tests/test_api.py`

**Interfaces:**
- Consumes: `parse_xlsx`, `export_xlsx`
- Produces: FastAPI `app` with `GET /health`, `POST /v1/parse`, `POST /v1/export`
- Env: `EXCEL_SERVICE_KEY` (required at runtime for protected routes; tests set it)

- [ ] **Step 1: Failing API tests**

```python
import os
os.environ["EXCEL_SERVICE_KEY"] = "test-key"

from fastapi.testclient import TestClient
from app.main import app
from app.export import export_xlsx

client = TestClient(app)


def test_health_no_key():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_parse_unauthorized():
    raw = export_xlsx("S", [["a"]])
    r = client.post("/v1/parse", files={"file": ("t.xlsx", raw, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert r.status_code == 401


def test_parse_ok():
    raw = export_xlsx("S", [["a", "b"]])
    r = client.post(
        "/v1/parse",
        headers={"X-Service-Key": "test-key"},
        files={"file": ("t.xlsx", raw, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert r.status_code == 200
    assert r.json()["rows"][0]["c"] == ["a", "b"]


def test_export_ok():
    r = client.post(
        "/v1/export",
        headers={"X-Service-Key": "test-key"},
        json={"sheet": "Out", "rows": [["x"], [1]]},
    )
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers["content-type"]
```

- [ ] **Step 2: Run — expect FAIL** (main missing)

```bash
cd services/excel-service && . .venv/bin/activate && pytest tests/test_api.py -v
```

- [ ] **Step 3: Implement auth + routes**

`auth.py`:

```python
import os
from fastapi import Header, HTTPException

def require_service_key(x_service_key: str | None = Header(default=None, alias="X-Service-Key")):
    expected = (os.environ.get("EXCEL_SERVICE_KEY") or "").strip()
    if not expected or x_service_key != expected:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid service key"}})
```

`errors.py`: helper to return `{ "error": { "code", "message" } }` for 400 from `ValueError`.

`main.py`:
- `MAX_UPLOAD = 5 * 1024 * 1024`
- `/health` → `{ok: true, service: "excel"}`
- `/v1/parse`: Depends(require_service_key); read upload; reject if size > MAX or filename ends with `.xls` (not xlsx); call `parse_xlsx`; on ValueError → 400
- `/v1/export`: Depends(require_service_key); body model `sheet: str = "Sheet1"`, `rows: list[list]`; return `Response(content=bytes, media_type=..., headers=Content-Disposition)`

- [ ] **Step 4: Run all Python tests — PASS**

```bash
cd services/excel-service && . .venv/bin/activate && pytest -v
```

- [ ] **Step 5: Commit**

```bash
git add services/excel-service/app services/excel-service/tests
git commit -m "$(cat <<'EOF'
feat(excel-service): expose health, parse, and export HTTP API

EOF
)"
```

---

### Task 3: Dockerfile + Compose

**Files:**
- Create: `services/excel-service/Dockerfile`
- Modify: `docker-compose.yml` — add `excel` service; `app.depends_on.excel`
- Modify: `quanluong-app-be/.env.docker.example` (and `.env.example`) — document vars
- Optionally update local `.env.docker` only if user already uses it in compose — prefer example files; note in report that real `.env.docker` needs the two keys

**Interfaces:**
- Produces: container reachable as `http://excel:8000` on compose network

- [ ] **Step 1: Dockerfile**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Compose service** (no host ports)

```yaml
  excel:
    build:
      context: ./services/excel-service
    image: quanluong-excel:latest
    container_name: quanluong-excel
    restart: unless-stopped
    environment:
      EXCEL_SERVICE_KEY: ${EXCEL_SERVICE_KEY:-dev-excel-key-change-me}
    # no ports: — internal only
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

On `app` service add:

```yaml
    environment:  # or rely on env_file — ensure these exist in .env.docker
      # EXCEL_SERVICE_URL=http://excel:8000
      # EXCEL_SERVICE_KEY=...
    depends_on:
      excel:
        condition: service_healthy
```

If `app` already has `depends_on`, merge `excel` into it. Put `EXCEL_SERVICE_URL=http://excel:8000` and matching key into `.env.docker.example`.

- [ ] **Step 3: Build smoke (optional if Docker available)**

```bash
docker compose --env-file quanluong-app-be/.env.docker build excel
```

If Docker unavailable, note in commit message / report and still land compose YAML.

- [ ] **Step 4: Commit**

```bash
git add services/excel-service/Dockerfile docker-compose.yml \
  quanluong-app-be/.env.example quanluong-app-be/.env.docker.example
git commit -m "$(cat <<'EOF'
chore: add excel service to Docker Compose

EOF
)"
```

---

### Task 4: Node env + excel-service client

**Files:**
- Modify: `quanluong-app-be/src/config/env.js`
- Modify: `quanluong-app-be/src/config/config.js`
- Create: `quanluong-app-be/src/services/excel-service.client.js`
- Create: `quanluong-app-be/src/services/excel-service.client.test.js`

**Interfaces:**
- Produces:
  - `config.excelService = { url, key, timeoutMs }`
  - `isExcelServiceConfigured(): boolean`
  - `parseWorkbook(buffer: Buffer, { sheet?: string }): Promise<object>`
  - `exportWorkbook({ sheet?: string, rows: any[][] }): Promise<Buffer>`

- [ ] **Step 1: Failing Node tests** (mock global fetch)

```js
import assert from "node:assert/strict";
import test from "node:test";

// Set env before importing client/config — follow existing test patterns in BE.
process.env.EXCEL_SERVICE_URL = "http://excel.test";
process.env.EXCEL_SERVICE_KEY = "k";
process.env.EXCEL_SERVICE_TIMEOUT_MS = "5000";

// Dynamic import after env if config caches at load — mirror other client tests.
```

Implement tests that:
1. `isExcelServiceConfigured()` true when URL set
2. With URL cleared / empty → `parseWorkbook` throws `AppError` message matching /chưa cấu hình|not configured/i (Vietnamese: «Excel service chưa cấu hình»)
3. Mock fetch 200 JSON for parse → returns body
4. Mock fetch 401 → AppError status 400 or 401 (pick one: map 401→502/401; prefer statusCode 502 with clear message OR 401 — use **502** for upstream auth misconfig per «5xx/network → 502»; for upstream 400 use 400)
5. Mock export returns arrayBuffer → Buffer

- [ ] **Step 2: Run — expect FAIL**

```bash
cd quanluong-app-be && node --test src/services/excel-service.client.test.js
```

- [ ] **Step 3: Implement env + client**

`env.js` add:

```js
excelServiceUrl: (process.env.EXCEL_SERVICE_URL || "").trim().replace(/\/+$/, ""),
excelServiceKey: (process.env.EXCEL_SERVICE_KEY || "").trim(),
excelServiceTimeoutMs: (() => {
  const n = Number(process.env.EXCEL_SERVICE_TIMEOUT_MS || 15_000);
  return Number.isFinite(n) && n > 0 ? n : 15_000;
})(),
```

`config.js`:

```js
excelService: {
  url: env.excelServiceUrl,
  key: env.excelServiceKey,
  timeoutMs: env.excelServiceTimeoutMs,
},
```

Client sketch:

```js
import { config } from "../config/config.js";
import { AppError } from "../errors/AppError.js"; // verify exact path
import { ERROR_CODES } from "../errors/error-codes.js";

function assertConfigured() {
  if (!config.excelService.url) {
    throw new AppError({
      message: "Excel service chưa cấu hình (EXCEL_SERVICE_URL)",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR, // or a dedicated code if exists
    });
  }
}

async function parseWorkbook(buffer, { sheet } = {}) {
  assertConfigured();
  const url = new URL("/v1/parse", config.excelService.url);
  if (sheet) url.searchParams.set("sheet", sheet);
  const form = new FormData();
  form.append("file", new Blob([buffer]), "upload.xlsx");
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-Service-Key": config.excelService.key },
    body: form,
    signal: AbortSignal.timeout(config.excelService.timeoutMs),
  });
  // map status → AppError as per spec
  return res.json();
}
```

Locate `AppError` path via grep (`quanluong-app-be/src/errors/` or similar) and match existing client style (e.g. google-api-fetch).

- [ ] **Step 4: Run Node tests — PASS**

```bash
cd quanluong-app-be && node --test src/services/excel-service.client.test.js
```

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/config/env.js quanluong-app-be/src/config/config.js \
  quanluong-app-be/src/services/excel-service.client.js \
  quanluong-app-be/src/services/excel-service.client.test.js
git commit -m "$(cat <<'EOF'
feat(be): add Excel microservice HTTP client

EOF
)"
```

---

### Task 5: README + acceptance notes

**Files:**
- Create: `services/excel-service/README.md` — how to run pytest, env vars, curl examples against local uvicorn
- Modify: none else unless compose comment block at top of `docker-compose.yml` should mention `excel`

- [ ] **Step 1: Write short README** (≤40 lines): purpose, env, `uvicorn` local, pytest, curl parse/export with key

- [ ] **Step 2: Commit**

```bash
git add services/excel-service/README.md
git commit -m "$(cat <<'EOF'
docs(excel-service): add service README for local and Docker use

EOF
)"
```

---

## Plan self-review

1. **Spec coverage:** health, parse, export, service key, 5MB, compose no host port, Node client, env docs, no business migration — all tasked.
2. **Placeholders:** none.
3. **Types:** `parse_xlsx` / `export_xlsx` signatures consistent across Task 1–2; Node `parseWorkbook`/`exportWorkbook` match Task 4.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-16-excel-microservice.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
**2. Inline Execution** — run tasks in this session with checkpoints  

Which approach?
