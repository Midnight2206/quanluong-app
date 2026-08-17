# Document Service P3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `TemplateMetadata` contract, refactor P2 renderer to consume it, implement Excel Template Importer (Named Range `FIELD_*`, `TABLE_*`) with `excel_coords`, `BlobStore`/`NullBlobStore`, and `import_template()` DB persist — no HTTP, no MinIO.

**Architecture:** `app/template/metadata.py` defines shared dataclasses. `demo_metadata.build_demo_metadata()` replaces hardcoded column reads in renderer. `app/import/template_importer.py` parses `.xlsx` → same metadata shape. `template_service.import_template()` validates, optionally saves via `NullBlobStore`, writes Postgres ORM rows.

**Tech Stack:** openpyxl (existing), SQLAlchemy 2 (existing models), pytest, ReportLab renderer from P2.

**Spec:** `docs/superpowers/specs/2026-08-17-document-service-p3-design.md`

## Global Constraints

- P3 only: no HTTP routes, no MinIO real, no Node client, no `required_fields` enforcement (param exists, skip when `None`).
- Do **not** modify `app/pagination/page_planner.py` or P1 HTTP routes.
- Named Range: `FIELD_<name>` (snake_case), `TABLE_HEADER`, `TABLE_DATA_ROW`, optional `TABLE_SIGNATURE`.
- TABLE ranges must be **same sheet**; FIELD may differ sheet.
- Validate TABLE_HEADER vs TABLE_DATA_ROW: same sheet, same column/merge-group count, aligned Excel column bounds.
- `width_pt` for merged header cell = sum of constituent Excel column widths in points.
- `signature_block_height_pt`: from TABLE_SIGNATURE row y to margin_bottom when present; else default 80.
- `TemplateValidationError` for template convention failures; `ValueError` for corrupt file.
- Keep `render_demo_pdf()` — wrapper over `build_demo_metadata()` + `render_pdf()`.
- All P2 PDF tests must pass after refactor (no regression).
- YAGNI: no multi-sheet table support in P3.

## File map

| File | Role |
|------|------|
| `app/template/metadata.py` | TemplateMetadata dataclasses |
| `app/template/demo_metadata.py` | `build_demo_metadata()` from P2 layout |
| `app/import/blob.py` | BlobStore ABC, NullBlobStore |
| `app/import/errors.py` | TemplateValidationError |
| `app/import/excel_coords.py` | Excel → point, merge width, signature height |
| `app/import/template_importer.py` | `parse_template(xlsx_bytes, ...)` |
| `app/import/template_service.py` | `import_template(session, ...)` |
| `app/render/pdf_renderer.py` | Refactor → `render_pdf(metadata, ...)` |
| `tests/fixtures/templates/` | minimal + mismatched xlsx (or pytest factory) |
| `tests/test_*.py` | coords, metadata, importer, service, regression pdf |

---

### Task 1: `TemplateMetadata` + `build_demo_metadata()`

**Files:**
- Create: `app/template/__init__.py`
- Create: `app/template/metadata.py`
- Create: `app/template/demo_metadata.py`
- Create: `tests/test_template_metadata.py`

**Interfaces:**
- Dataclasses per spec: `FieldMeta`, `ColumnMeta`, `TableMeta`, `PageMeta`, `TemplateMetadata`
- `build_demo_metadata(*, name="demo", version="1") -> TemplateMetadata` — values from existing `demo_template.py` constants (5 columns, 4 fields, heights 22/18/80, margins A4)

- [ ] **Step 1: Implement metadata.py + demo_metadata.py**

Map existing `DEMO_COLUMNS` → `ColumnMeta.width_pt`, `DEMO_FIELDS` → `FieldMeta` with font/align dicts. Set `table.sheet_name = "demo"`.

- [ ] **Step 2: Test demo metadata**

```python
def test_build_demo_metadata_columns():
    m = build_demo_metadata()
    assert len(m.table.columns) == 5
    assert m.table.columns[0].key == "stt"
    assert sum(c.width_pt for c in m.table.columns) <= 523
```

- [ ] **Step 3: pytest + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(document-service): add TemplateMetadata and build_demo_metadata

EOF
)"
```

---

### Task 2: Refactor renderer → `render_pdf(metadata)`

**Files:**
- Modify: `app/render/pdf_renderer.py`
- Modify: `app/render/__init__.py`
- Ensure: `tests/test_pdf_renderer.py` unchanged assertions — all PASS

**Interfaces:**

```python
def render_pdf(*, metadata: TemplateMetadata, fields: dict[str, str], rows: list[dict[str, str]]) -> bytes: ...

def render_demo_pdf(*, fields: dict[str, str], rows: list[dict[str, str]]) -> bytes:
    return render_pdf(metadata=build_demo_metadata(), fields=fields, rows=rows)
```

- Replace reads of `DEMO_COLUMNS`, `DEMO_FIELDS`, `HEADER_HEIGHT`, etc. with `metadata.table`, `metadata.fields`, `metadata.page`.
- Keep `content_height_page1()` logic using `metadata.page.static_block_height_pt` and table block heights from `metadata.table`.
- Field rendering: use `FieldMeta.font`/`align`; preserve prefix behavior for demo fields (store full label in `title` or keep prefix in render for demo-only fields — simplest: demo `FieldMeta` includes display prefix in render path via optional `label_prefix` in FieldMeta or hardcode demo prefixes in `build_demo_metadata` only).

**Recommendation:** add optional `label_prefix: str = ""` on `FieldMeta` for «Đơn vị: » style labels; demo metadata sets prefixes; importer leaves empty.

- [ ] **Step 1: Refactor pdf_renderer**

- [ ] **Step 2: Run full pytest — expect all PASS including test_pdf_renderer**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(document-service): render_pdf consumes TemplateMetadata

EOF
)"
```

---

### Task 3: `excel_coords.py`

**Files:**
- Create: `app/import/__init__.py`
- Create: `app/import/excel_coords.py`
- Create: `tests/test_excel_coords.py`

**Interfaces:**

```python
def col_width_to_pt(width_char: float | None) -> float: ...
def merged_range_width_pt(sheet, min_col, max_col) -> float: ...
def cell_top_left_pt(sheet, row, col, *, page_height, margin_top) -> tuple[float, float]: ...  # x, y ReportLab
def signature_block_height_pt(signature_row_y: float, margin_bottom: float) -> float: ...
```

- Heuristic: `width_pt = max(10, col_width * 7)` per Excel column; merged = sum.
- Unit test: sheet with known column widths + merge 3 cols → expected width sum.
- Unit test: signature height = y - margin_bottom.

- [ ] **Implement + tests + commit**

---

### Task 4: `BlobStore` + `TemplateValidationError`

**Files:**
- Create: `app/import/blob.py`
- Create: `app/import/errors.py`
- Create: `tests/test_blob.py` (optional smoke)

- [ ] **Implement ABC + NullBlobStore per spec**

- [ ] **Commit**

---

### Task 5: `template_importer.py` + fixtures + tests

**Files:**
- Create: `app/import/template_importer.py`
- Create: `tests/conftest.py` or `tests/fixtures/template_factory.py` — helpers to build xlsx with openpyxl
- Create: `tests/test_template_importer.py`

**Interfaces:**

```python
def parse_template(xlsx_bytes: bytes, *, name: str, version: str) -> TemplateMetadata: ...
```

**Fixture factory (preferred over binary commit):**

- `make_minimal_template()` → bytes with sheet `ChungTu`, `FIELD_don_vi`, `FIELD_ngay_thang`, `TABLE_HEADER` row 5, `TABLE_DATA_ROW` row 6, 5 columns
- `make_mismatched_columns_template()` → header 5 cols, data row 4 cols

**Importer logic:**

1. Load workbook with openpyxl
2. Resolve defined names → sheet + cell ranges
3. Collect `FIELD_*` → FieldMeta (validate `[a-z0-9_]+` suffix)
4. Parse TABLE_HEADER row → merge groups left-to-right → ColumnMeta (slug key from header text)
5. Parse TABLE_DATA_ROW → validate same sheet, count, column bounds vs header
6. Optional TABLE_SIGNATURE → compute `signature_block_height_pt`
7. Page margins from worksheet or defaults

- [ ] **Step 1: Failing tests** (minimal ok, mismatched raises)

- [ ] **Step 2: Implement importer**

- [ ] **Step 3: Optional integration: `parse_template` + `render_pdf` smoke on minimal fixture**

- [ ] **Step 4: pytest + commit**

---

### Task 6: `template_service.import_template()`

**Files:**
- Create: `app/import/template_service.py`
- Create: `tests/test_template_service.py`

**Interfaces:** per spec — map TemplateMetadata → `Template`, `TemplateField`, `TemplateTableConfig`; `file_path=None`; mock session test.

- [ ] **Implement service + mock session test**

- [ ] **Commit**

---

### Task 7: README + docs pointer

**Files:**
- Modify: `services/document-service/README.md`

- [ ] Add P3 section: TemplateMetadata, parse_template, import_template, Named Range table, no HTTP
- [ ] Commit plan + spec if untracked:

```bash
git add docs/superpowers/specs/2026-08-17-document-service-p3-design.md \
  docs/superpowers/plans/2026-08-17-document-service-p3.md
```

---

## Plan self-review

1. **Spec coverage:** metadata first, renderer refactor, coords, importer validation (sheet/column/merge), BlobStore stub, DB persist, no HTTP — all tasked.
2. **P2 regression:** Task 2 explicitly gates on existing PDF tests.
3. **Fixtures:** factory over binary xlsx reduces repo noise; matches openpyxl already in deps.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-08-17-document-service-p3.md`.

**1. Subagent-Driven (recommended)**  
**2. Inline Execution**

Which approach?
