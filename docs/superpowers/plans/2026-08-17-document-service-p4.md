# Document Service P4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HTTP upload of `.xlsx` templates and PDF generation from Postgres metadata — no MinIO, no Node, no FE, no `documents` insert.

**Architecture:** Thin FastAPI routes over P3 `import_template` + new `load_metadata_from_db` + existing `render_pdf`. Unique `(name, version)` at DB + pre-insert check. Extra row keys ignored. RFC 5987 Content-Disposition.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, pytest TestClient, existing importer/renderer.

**Spec:** `docs/superpowers/specs/2026-08-17-document-service-p4-design.md` (user-normalized version — follow that file, not earlier chat drafts).

## Global Constraints

- Follow spec validation **order** on POST `/v1/templates`: auth → input format → `TemplateValidationError` from parse → duplicate `(name, version)`.
- Duplicate: check **before insert** AND unique DB constraint (race safety). Duplicate HTTP → 400 `TEMPLATE_EXISTS`.
- `column_defs` JSON **array** (not dict); preserve column order and `width_pt` as float round-trip.
- Extra keys on each `rows[]` item: **silent ignore**.
- Pagination infeasible → 400 `PAGINATION_FAILED` with planner message verbatim.
- `Content-Disposition`: `filename="document.pdf"; filename*=UTF-8''{percent-encoded name-version}.pdf`
- No insert into `documents`. No MinIO. No Node. `required_fields` stays None.
- Do not change `page_planner.py` algorithm.
- Error envelope `{ "error": { "code", "message" } }`. Auth same as P1 (401).
- `app.import` is a Python keyword — tests use `importlib.import_module`.

## File map

| File | Role |
|------|------|
| Alembic revision unique name+version | DB constraint |
| `app/models.py` | UniqueConstraint; `column_defs` typed as list |
| `app/import/template_service.py` | Pre-insert duplicate check |
| `app/import/metadata_store.py` (or similar) | `load_metadata_from_db` |
| `app/main.py` | New routes |
| `tests/test_load_metadata.py` | Round-trip |
| `tests/test_templates_http.py` | Upload/fields/documents API |

---

### Task 1: Unique `(name, version)` + pre-insert check

**Files:**
- Create Alembic: `20260817_0003_templates_name_version_unique.py`
- Modify: `app/models.py` — `UniqueConstraint("name", "version", name="templates_name_version_key")`
- Modify: `app/import/template_service.py` — before add, query existing; if found raise `TemplateValidationError` **or** a dedicated error. Spec HTTP code is `TEMPLATE_EXISTS` distinct from `TEMPLATE_INVALID`. Prefer a small exception `TemplateExistsError` (message Vietnamese spec text) so routes can map 400 `TEMPLATE_EXISTS` vs `TEMPLATE_INVALID`. Catch `IntegrityError` on unique violation → same exists error.

- [ ] **Step 1:** Migration unique index

- [ ] **Step 2:** `import_template` pre-check + IntegrityError mapping

- [ ] **Step 3:** Unit test mock session: second import same name/version raises exists error

- [ ] **Commit** `feat(document-service): unique template name and version`

---

### Task 2: `load_metadata_from_db` + round-trip

**Files:**
- Create: `app/import/metadata_store.py` — `load_metadata_from_db(session, template_id) -> TemplateMetadata | None`
- Modify: `models.py` `column_defs` annotation `list | dict | None` if needed; persist already uses list of asdict
- Create: `tests/test_load_metadata.py`

Map ORM → dataclasses. Reconstruct `ColumnMeta` from JSON **array** in stored order; coerce `width_pt` to `float`. `label_prefix=""`. `TableMeta.sheet_name` from first field sheet or from header_row_range prefix — if P3 persist does not store `sheet_name` on table_config, parse from `header_row_range` (`Sheet1!A10:E10`) or use field's table sheet; check P3 `header_row_range` format.

- [ ] **Round-trip test:** `parse_template` → `import_template` (real or mock that still round-trips JSON) → `load_metadata_from_db` — compare columns order, `width_pt` float equality, `align_h`, field names.

If mock session cannot round-trip easily, use SQLite/Postgres like `test_templates.py` **or** serialize via the same `column_defs=[asdict(...)]` list then deserialize without full DB. Prefer in-memory SQLite creating all tables if JSON works; if JSONB-only fails, construct TemplateTableConfig in Python and call loader with a stub session. Simplest robust path: unit-test deserializer `table_config_to_metadata` separately plus one import_template + load with mocked flush ids.

- [ ] **Commit** `feat(document-service): load TemplateMetadata from Postgres rows`

---

### Task 3: `POST /v1/templates`

**Files:**
- Modify: `app/main.py`
- Create: `tests/test_templates_http.py` (or extend)

Validation order per spec. Reuse MAX_UPLOAD / xlsx check from parse. Form: `name`, `version`, `file`. Empty name/version → 400 `BAD_REQUEST`. Map `TemplateValidationError` → 400 `TEMPLATE_INVALID`. Map exists → 400 `TEMPLATE_EXISTS`. `run_in_threadpool` for parse/import CPU.

Requires DB: follow `test_templates.py` monkeypatch `get_session` + create all tables (Template, TemplateField, TemplateTableConfig).

- [ ] Tests: 201 upload factory xlsx; duplicate 400 TEMPLATE_EXISTS; missing TABLE_HEADER 400 TEMPLATE_INVALID; no key 401

- [ ] **Commit** `feat(document-service): POST /v1/templates upload`

---

### Task 4: `GET /v1/templates/{id}` and `.../fields`

**Files:** `app/main.py`, tests in `test_templates_http.py`

404 `NOT_FOUND` Vietnamese message. Fields payload per spec (no coords/fonts).

- [ ] **Commit** `feat(document-service): GET template by id and fields`

---

### Task 5: `POST /v1/templates/{id}/documents`

**Files:**
- Modify: `app/main.py`
- Helper for Content-Disposition RFC 5987
- Tests: 3 rows → `%PDF`; extra row keys no error; missing template 404; bad rows type 400; Vietnamese name in filename*

`ValueError` from `plan_pages` → 400 `PAGINATION_FAILED`. No `.xlsx` open in this path (only `load_metadata_from_db` + `render_pdf`).

- [ ] **Commit** `feat(document-service): POST documents returns PDF from DB metadata`

---

### Task 6: README

**Files:** `services/document-service/README.md`

Document new routes, curl examples, unique name/version, no documents persist.

- [ ] **Commit** `docs(document-service): document P4 HTTP upload and PDF API`

---

## Plan self-review

Spec items: validation order, TEMPLATE_EXISTS vs INVALID, unique SQL + pre-check, JSON array columns, extra row keys, PAGINATION_FAILED, RFC 5987, round-trip, no documents table writes — all tasked.

---

## Execution handoff

Plan: `docs/superpowers/plans/2026-08-17-document-service-p4.md`.

**1. Subagent-Driven (recommended)**  
**2. Inline Execution**

Which approach?
