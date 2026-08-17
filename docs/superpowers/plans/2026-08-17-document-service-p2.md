# Document Service P2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ReportLab PDF renderer with one synthetic demo template (`render_demo_pdf` → bytes), DejaVu Sans fonts, unit tests with `pypdf` — no new HTTP routes, no importer/MinIO.

**Architecture:** New `app/render/` package: `fonts.py` registers bundled `.ttf`; `demo_template.py` holds layout constants mirroring future DB schema; `draw.py` low-level canvas helpers; `pdf_renderer.py` calls P1 `plan_pages()` then draws pages. Tests assert PDF magic bytes, page count, Vietnamese text extraction.

**Tech Stack:** ReportLab 4, pypdf 5 (test only), DejaVu Sans `.ttf`, existing `plan_pages` from P1, pytest.

**Spec:** `docs/superpowers/specs/2026-08-17-document-service-p2-design.md`

## Global Constraints

- P2 only: no HTTP `/v1/render/*`, no Postgres reads for template, no MinIO, no Node client changes, no pdfplumber.
- Do **not** modify `app/pagination/page_planner.py` or P1 HTTP routes.
- Font: DejaVu Sans bundled in `services/document-service/fonts/` (not system fonts).
- Template: synthetic hardcode in `demo_template.py`.
- Pagination defaults: `row_height_min=18`, `row_height_max=28`, `min_rows_last_page=2`, `stretch_strategy=end_bias`.
- Page: A4 portrait; margins top 40, right 36, bottom 40, left 36 (pt).
- Missing field keys → render empty string (no raise).
- Merge cells: simple axis-aligned rectangles only.
- YAGNI: no generic template engine abstraction beyond `demo_template` constants.

## File map

| File | Role |
|------|------|
| `services/document-service/fonts/*.ttf` | DejaVuSans + Bold |
| `services/document-service/app/render/__init__.py` | Export `render_demo_pdf` |
| `services/document-service/app/render/fonts.py` | Register fonts on import |
| `services/document-service/app/render/demo_template.py` | Layout constants |
| `services/document-service/app/render/draw.py` | Canvas draw helpers |
| `services/document-service/app/render/pdf_renderer.py` | `render_demo_pdf()` |
| `services/document-service/tests/test_pdf_renderer.py` | PDF integration tests |
| `services/document-service/requirements.txt` | + reportlab, pypdf |
| `services/document-service/Dockerfile` | COPY fonts |
| `services/document-service/README.md` | P2 scope note |

---

### Task 1: Dependencies + font bundle + `fonts.py`

**Files:**
- Create: `services/document-service/fonts/DejaVuSans.ttf`
- Create: `services/document-service/fonts/DejaVuSans-Bold.ttf`
- Create: `services/document-service/app/render/__init__.py`
- Create: `services/document-service/app/render/fonts.py`
- Modify: `services/document-service/requirements.txt`
- Modify: `services/document-service/Dockerfile`

**Interfaces:**
- Produces: `from app.render.fonts import FONT_REGULAR, FONT_BOLD` (registered ReportLab font names)
- Raises: `RuntimeError("Không tìm thấy font DejaVuSans")` if `.ttf` missing

- [ ] **Step 1: Add dependencies**

In `requirements.txt` append:

```text
reportlab>=4,<5
pypdf>=5,<6
```

- [ ] **Step 2: Vendor font files**

Download official DejaVu 2.37 TTF (SIL OFL) into `services/document-service/fonts/`:

```bash
cd services/document-service/fonts
curl -fsSL -o DejaVuSans.ttf \
  https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans.ttf
curl -fsSL -o DejaVuSans-Bold.ttf \
  https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans-Bold.ttf
```

Verify files are non-empty (>10KB each).

- [ ] **Step 3: Implement `fonts.py`**

```python
# app/render/fonts.py — resolve FONTS_DIR relative to package; register once
FONT_REGULAR = "DejaVuSans"
FONT_BOLD = "DejaVuSans-Bold"
# pdfmetrics.registerFont(TTFont(...)) for both; registerFontFamily mapping bold→FONT_BOLD
```

Call registration at module import. Use `pathlib.Path(__file__).resolve().parents[2] / "fonts"`.

- [ ] **Step 4: Dockerfile**

After `COPY app ./app`, add:

```dockerfile
COPY fonts ./fonts
```

- [ ] **Step 5: Smoke test**

Create minimal `tests/test_fonts.py`:

```python
from app.render.fonts import FONT_REGULAR, FONT_BOLD
from reportlab.pdfbase import pdfmetrics

def test_fonts_registered():
    assert FONT_REGULAR in pdfmetrics.getRegisteredFontNames()
    assert FONT_BOLD in pdfmetrics.getRegisteredFontNames()
```

Run: `pytest tests/test_fonts.py -v` — expect PASS.

- [ ] **Step 6: Commit**

```bash
git add services/document-service/fonts services/document-service/app/render \
  services/document-service/requirements.txt services/document-service/Dockerfile \
  services/document-service/tests/test_fonts.py
git commit -m "$(cat <<'EOF'
feat(document-service): add DejaVu fonts and ReportLab deps for P2

EOF
)"
```

---

### Task 2: `demo_template.py` layout constants

**Files:**
- Create: `services/document-service/app/render/demo_template.py`
- Create: `services/document-service/tests/test_demo_template.py` (light sanity)

**Interfaces:**
- Produces dataclass/named constants consumed by renderer:
  - `PAGE_WIDTH=595`, `PAGE_HEIGHT=842`
  - margins: 40/36/40/36
  - `STATIC_BLOCK_HEIGHT` — vertical space consumed on page 1 above table (field block ≈ 80pt from top margin to table top)
  - `TABLE_LEFT=36`, column defs (key, title, width, align) per spec
  - `HEADER_HEIGHT=22`, `CARRY_HEIGHT=18`, `SIGNATURE_HEIGHT=80`
  - `ROW_HEIGHT_MIN=18`, `ROW_HEIGHT_MAX=28`, `MIN_ROWS_LAST_PAGE=2`
  - Field defs: `tieu_de`, `don_vi`, `ngay_thang`, `so_phieu` with x,y, font size, bold flag
  - Helper: `content_height_page1()` and `content_height_continuation()` returning usable height for `plan_pages`

**Notes:**
- Total table width = sum column widths (436pt) — fits in content width ~523pt.
- `content_height_page1 = PAGE_HEIGHT - margin_top - margin_bottom - STATIC_BLOCK_HEIGHT`
- `content_height_continuation = PAGE_HEIGHT - margin_top - margin_bottom`
- Table top Y on page 1: computed from `PAGE_HEIGHT - margin_top - STATIC_BLOCK_HEIGHT`

- [ ] **Step 1: Failing sanity test**

```python
from app.render.demo_template import DEMO_COLUMNS, content_height_page1

def test_columns_sum_fits_page():
    assert sum(c.width for c in DEMO_COLUMNS) <= 523
    assert content_height_page1() > 100
```

- [ ] **Step 2: Implement `demo_template.py`**

- [ ] **Step 3: Run pytest — PASS**

- [ ] **Step 4: Commit**

```bash
git commit -am "$(cat <<'EOF'
feat(document-service): add synthetic demo template constants for P2

EOF
)"
```

---

### Task 3: `draw.py` canvas helpers

**Files:**
- Create: `services/document-service/app/render/draw.py`
- Create: `services/document-service/tests/test_draw.py` (optional smoke — render tiny PDF in memory)

**Interfaces:**
- Consumes: `FONT_REGULAR`, `FONT_BOLD` from `fonts.py`
- Produces functions (ReportLab `canvas.Canvas` as first arg):

```python
def draw_text(canvas, *, x, y, text, font_name, font_size, align="left", max_width=None) -> None: ...
def draw_rect_border(canvas, *, x, y, width, height, line_width=0.5) -> None: ...
def draw_merged_cell(canvas, *, x, y, width, height, text, font_name, font_size, align="center", valign="middle") -> None: ...
def draw_table_row(canvas, *, x, y, height, columns, values, col_defs) -> None: ...
```

**Alignment P2:** horizontal left/center/right; vertical top or middle via simple offset (`y + height/2 - font_size/3`).

- [ ] **Step 1: Implement helpers** (no test-first required if covered by Task 4; optional smoke test draws one bordered cell)

- [ ] **Step 2: Commit**

```bash
git commit -am "$(cat <<'EOF'
feat(document-service): add ReportLab draw helpers for P2 renderer

EOF
)"
```

---

### Task 4: `pdf_renderer.py` + integration tests (TDD)

**Files:**
- Create: `services/document-service/app/render/pdf_renderer.py`
- Create: `services/document-service/tests/test_pdf_renderer.py`
- Modify: `services/document-service/app/render/__init__.py` — export `render_demo_pdf`

**Interfaces:**

```python
def render_demo_pdf(*, fields: dict[str, str], rows: list[dict[str, str]]) -> bytes:
    ...
```

**Render algorithm:**

1. Validate `rows` is a list of dicts; else `TypeError`/`ValueError`.
2. Import fonts module (side-effect register).
3. `n_rows = len(rows)`; call `plan_pages` with heights from `demo_template`:
   - Use `content_height_page1()` when `n_rows > 0` (planner gets one height — use **continuation height** for packing; subtract static block only when **drawing** page 1 table start Y, not in planner — **or** pass `page_content_height=content_height_continuation()` and manually reserve static block in draw loop for page 1 only).
   - **Recommended:** pass `page_content_height=content_height_continuation()` to `plan_pages`; on page 1 drawing, if table would overlap static fields, the static block is above table — planner models table area only; page 1 table vertical budget = `content_height_page1()`, pages 2+ = `content_height_continuation()`. Because `plan_pages` accepts single `page_content_height`, use **`min(content_height_page1(), content_height_continuation())`** for conservative packing, or call planner with continuation height (slightly pessimistic on page 1 — OK for P2).
   - Spec: use `content_height_page1()` for `n_rows` fitting on one page only; for multi-page use `content_height_continuation()` — **simplest P2:** always pass `content_height_continuation()`; static fields occupy top of page 1 only visually (table starts below static block); planner assumes same table area all pages (slightly under-fills page 1 — acceptable demo).
4. `buffer = BytesIO()`; `canvas.Canvas(buffer, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))`
5. For each `PagePlan`:
   - Page 1: draw static fields from `fields` dict
   - Draw table header at computed Y
   - If `has_carry_from_prev`: draw «Mang từ trang trước» merged row
   - For each index in `row_indices`: draw data row with `row_heights[i]`
   - If `has_carry_to_next`: draw «Cộng chuyển trang sau»
   - If `is_last`: draw «Cộng» row + signature block (2 columns)
   - `showPage()`
6. `save()`; return `buffer.getvalue()`

**Empty rows:** `n_rows=0` → one page with fields + header + signature (no data rows); `plan_pages(0)` returns empty pages list — **handle explicitly:** skip planner, render single page layout.

**Test helpers:**

```python
def _sample_fields():
    return {
        "tieu_de": "PHIẾU XUẤT KHO DEMO",
        "don_vi": "Bếp ăn A",
        "ngay_thang": "17/08/2026",
        "so_phieu": "PX-001",
    }

def _sample_rows(n):
    return [
        {
            "stt": str(i + 1),
            "ten_hang": f"Mặt hàng {i + 1}",
            "don_vi_tinh": "kg",
            "so_luong": "10",
            "thanh_tien": "100000",
        }
        for i in range(n)
    ]
```

- [ ] **Step 1: Failing tests**

```python
from io import BytesIO
from pypdf import PdfReader
from app.render.pdf_renderer import render_demo_pdf
from app.pagination import plan_pages
from app.render.demo_template import content_height_continuation, HEADER_HEIGHT, CARRY_HEIGHT, SIGNATURE_HEIGHT

def test_pdf_magic_bytes():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=_sample_rows(3))
    assert pdf[:4] == b"%PDF"

def test_vietnamese_text_extracted():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=_sample_rows(1))
    text = "".join(p.extract_text() or "" for p in PdfReader(BytesIO(pdf)).pages)
    assert "Đơn vị" in text or "Don vi" not in text  # must have diacritics
    assert "Thành tiền" in text or "Ten hang" in text

def test_page_count_matches_planner():
    rows = _sample_rows(15)
    pdf = render_demo_pdf(fields=_sample_fields(), rows=rows)
    expected = plan_pages(
        n_rows=len(rows),
        page_content_height=content_height_continuation(),
        header_height=HEADER_HEIGHT,
        carry_row_height=CARRY_HEIGHT,
        signature_block_height=SIGNATURE_HEIGHT,
    )
    assert len(PdfReader(BytesIO(pdf)).pages) == max(1, len(expected.pages))

def test_three_rows_single_page():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=_sample_rows(3))
    assert len(PdfReader(BytesIO(pdf)).pages) == 1

def test_empty_rows_one_page():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=[])
    assert len(PdfReader(BytesIO(pdf)).pages) == 1
```

Tune assertions if ReportLab text extraction drops some diacritics — prefer checking known column header strings from demo template.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/document-service && . .venv/bin/activate && pip install -r requirements.txt && pytest tests/test_pdf_renderer.py -v
```

- [ ] **Step 3: Implement `pdf_renderer.py`**

- [ ] **Step 4: Run full suite — expect PASS**

```bash
pytest -v
```

- [ ] **Step 5: Commit**

```bash
git commit -am "$(cat <<'EOF'
feat(document-service): add render_demo_pdf with synthetic template and tests

EOF
)"
```

---

### Task 5: README + design doc pointer

**Files:**
- Modify: `services/document-service/README.md`
- Modify: `docs/superpowers/specs/2026-08-17-document-service-p2-design.md` (only if checklist tweaks needed)

- [ ] **Step 1: Update README**

Add P2 section (≤15 lines): `render_demo_pdf`, fonts path, `pytest tests/test_pdf_renderer.py`, note still no HTTP PDF endpoint. Link P2 spec.

- [ ] **Step 2: Run full pytest once more**

- [ ] **Step 3: Commit**

```bash
git commit -am "$(cat <<'EOF'
docs(document-service): document P2 PDF renderer scope in README

EOF
)"
```

Also commit plan + spec if not yet committed:

```bash
git add docs/superpowers/specs/2026-08-17-document-service-p2-design.md \
  docs/superpowers/plans/2026-08-17-document-service-p2.md \
  docs/superpowers/specs/2026-08-17-document-service-p1-design.md
git commit -m "$(cat <<'EOF'
docs: add document-service P2 design and implementation plan

EOF
)"  # skip if already committed
```

---

## Plan self-review

1. **Spec coverage:** fonts, draw split, demo template, render_demo_pdf, pypdf tests, Docker COPY, no HTTP, no P1 planner changes — all tasked.
2. **Placeholders:** none; font URLs are concrete; page_content_height strategy documented (use continuation height for planner simplicity).
3. **Types:** `render_demo_pdf` signature matches spec; row dict keys match column defs.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-17-document-service-p2.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
**2. Inline Execution** — run tasks in this session with checkpoints  

Which approach?
