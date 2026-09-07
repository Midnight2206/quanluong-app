# Amount-in-words below table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document-service always draws `Tổng số tiền (Viết bằng chữ): …` in bold at table body font size immediately under the last-page «Cộng» row, without relying on Excel Named Range placement.

**Architecture:** Port VND→Vietnamese words into `app/render/vnd_words.py`. Resolve amount (prefer `fields.tong_tien` / `tong_tien_so`, else sum amount column). Draw via `amount_in_words.py` after «Cộng» on the last page; skip rendering Named Range `tong_tien_bang_chu`. Reserve measured line height in page planning so the signature does not overlap.

**Tech Stack:** Python 3.12, ReportLab, existing `carry_totals.parse_amount` / `sum_amount`, `text_wrap`, `pdf_renderer`, pytest + pypdf.

## Global Constraints

- Prefix exactly: `Tổng số tiền (Viết bằng chữ): ` + output of VND words util (util already includes `đồng` and capitalizes first letter).
- Draw only on last table page, after «Cộng», before signature / other `below_table` content.
- Style: `FONT_BOLD`, size = table `row_font_size`, left-aligned at table left, wrap within table width.
- Skip drawing scalar `tong_tien_bang_chu` (Named Range) to avoid duplicate lines; also exclude it from signature anchor `extra_fields`.
- Amount: prefer non-empty `fields["tong_tien"]` or `fields["tong_tien_so"]` via `parse_amount` (0 allowed); else `find_amount_column_key` + `sum_amount`; if neither → do not draw.
- Words always generated in document-service (ignore client `tong_tien_bang_chu` text).
- No Node/FE required changes in this plan.
- Out of scope: Drive Sheets path, toggle UI, i18n.

---

## File map

| File | Responsibility |
|------|----------------|
| `services/document-service/app/render/vnd_words.py` | `vnd_to_vietnamese_document_line(value) -> str` |
| `services/document-service/tests/test_vnd_words.py` | Parity with Node util cases |
| `services/document-service/app/render/amount_in_words.py` | Resolve, format, measure, draw |
| `services/document-service/tests/test_amount_in_words.py` | Resolve/format/skip helpers |
| `services/document-service/app/render/pdf_renderer.py` | Hook last page; planner reserve; skip Named Range |
| `services/document-service/tests/test_pdf_renderer.py` | Extracted PDF contains prefix line |

---

### Task 1: Port `vnd_to_vietnamese_document_line`

**Files:**
- Create: `services/document-service/app/render/vnd_words.py`
- Create: `services/document-service/tests/test_vnd_words.py`

**Interfaces:**
- Produces: `vnd_to_vietnamese_document_line(value: float | int | str | None) -> str`

- [ ] **Step 1: Write failing tests** (match Node `chung-tu-vnd.util.test.js`)

```python
from app.render.vnd_words import vnd_to_vietnamese_document_line

def test_reads_three_digit_groups():
    text = vnd_to_vietnamese_document_line(103_324_000)
    assert "undefined" not in text
    assert text == "Một trăm linh ba triệu ba trăm hai mươi bốn nghìn đồng"

def test_zero_padded_lower_groups():
    text = vnd_to_vietnamese_document_line(1_024_000)
    assert text == "Một triệu không trăm hai mươi bốn nghìn đồng"

def test_zero():
    assert vnd_to_vietnamese_document_line(0) == "Không đồng"

def test_invalid_returns_empty():
    assert vnd_to_vietnamese_document_line(None) == ""
    assert vnd_to_vietnamese_document_line(-1) == ""
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd services/document-service && ./.venv/bin/pytest tests/test_vnd_words.py -v`  
Expected: import error / missing module

- [ ] **Step 3: Implement** — port logic from `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-vnd.util.js` (`UNITS`, `readTens`, `readGroup`, `vndToVietnameseDocumentLine`) into Python. Cap first letter with `str.title`-style: `s[0].upper() + s[1:]` using Vietnamese locale if available (`s[0].upper()` is enough for ASCII-start words; Node uses `toLocaleUpperCase("vi")` — use `s[:1].upper() + s[1:]`).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add services/document-service/app/render/vnd_words.py \
  services/document-service/tests/test_vnd_words.py
git commit -m "feat(document): port VND amount-to-words util"
```

---

### Task 2: Resolve amount + format line helpers

**Files:**
- Create: `services/document-service/app/render/amount_in_words.py`
- Create: `services/document-service/tests/test_amount_in_words.py`

**Interfaces:**
- Consumes: `vnd_to_vietnamese_document_line`, `parse_amount`, `find_amount_column_key`, `sum_amount`
- Produces:
  - `AMOUNT_IN_WORDS_PREFIX = "Tổng số tiền (Viết bằng chữ): "`
  - `SKIP_SCALAR_FIELD_NAMES = frozenset({"tong_tien_bang_chu"})`
  - `resolve_document_amount(fields: dict | None, rows: list[dict], columns) -> float | None`
  - `format_amount_in_words_line(amount: float) -> str`
  - `should_skip_scalar_field(field_name: str) -> bool`

- [ ] **Step 1: Failing tests**

```python
from app.render.amount_in_words import (
    AMOUNT_IN_WORDS_PREFIX,
    format_amount_in_words_line,
    resolve_document_amount,
    should_skip_scalar_field,
)
from app.template.metadata import ColumnMeta

def test_resolve_prefers_tong_tien_field():
    columns = [ColumnMeta("thanh_tien", "Thành tiền", 80, "right")]
    rows = [{"thanh_tien": "1.000"}]
    assert resolve_document_amount({"tong_tien": "50.000"}, rows, columns) == 50000.0

def test_resolve_falls_back_to_row_sum_when_field_empty():
    columns = [ColumnMeta("thanh_tien", "Thành tiền", 80, "right")]
    rows = [{"thanh_tien": "10.000"}, {"thanh_tien": "5.000"}]
    assert resolve_document_amount({"tong_tien": "  "}, rows, columns) == 15000.0

def test_resolve_none_without_field_or_amount_column():
    columns = [ColumnMeta("stt", "STT", 30, "center")]
    assert resolve_document_amount({}, [], columns) is None

def test_format_line_prefix():
    line = format_amount_in_words_line(100_000)
    assert line.startswith(AMOUNT_IN_WORDS_PREFIX)
    assert line == AMOUNT_IN_WORDS_PREFIX + "Một trăm nghìn đồng"

def test_skip_tong_tien_bang_chu():
    assert should_skip_scalar_field("tong_tien_bang_chu") is True
    assert should_skip_scalar_field("don_vi") is False
```

(`ColumnMeta` constructor — check `metadata.py` and match existing test_carry_totals usage.)

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```python
AMOUNT_IN_WORDS_PREFIX = "Tổng số tiền (Viết bằng chữ): "
SKIP_SCALAR_FIELD_NAMES = frozenset({"tong_tien_bang_chu"})

def should_skip_scalar_field(field_name: str) -> bool:
    key = str(field_name or "").strip().lower()
    return key in SKIP_SCALAR_FIELD_NAMES

def resolve_document_amount(fields, rows, columns) -> float | None:
    payload = fields if isinstance(fields, dict) else {}
    for key in ("tong_tien", "tong_tien_so"):
        if key not in payload:
            continue
        raw = payload.get(key)
        if raw is None or str(raw).strip() == "":
            continue
        return parse_amount(raw)
    amount_key = find_amount_column_key(columns)
    if not amount_key:
        return None
    if not rows:
        return None
    return sum_amount(rows, amount_key)

def format_amount_in_words_line(amount: float) -> str:
    words = vnd_to_vietnamese_document_line(amount)
    if not words:
        return ""
    return f"{AMOUNT_IN_WORDS_PREFIX}{words}"
```

- [ ] **Step 4: PASS + Commit**

```bash
git commit -m "feat(document): resolve and format amount-in-words line"
```

---

### Task 3: Draw line + wire `pdf_renderer` + planner reserve

**Files:**
- Modify: `services/document-service/app/render/amount_in_words.py` (add measure + draw)
- Modify: `services/document-service/app/render/pdf_renderer.py`
- Modify: `services/document-service/tests/test_amount_in_words.py`
- Modify: `services/document-service/tests/test_pdf_renderer.py`

**Interfaces:**
- Produces: `measure_amount_in_words_height(text, font_name, font_size, max_width) -> float`
- Produces: `draw_amount_in_words_line(pdf, *, text, x, y_top, max_width, font_size) -> float`  
  Returns **new y** (bottom after drawing; ReportLab y decreases downward). Convention: input `y_top` is current cursor after «Cộng» (baseline area); draw below it and return y for signature anchor.
- Consumes: `FONT_BOLD`, `wrap_text_to_width`, `line_height_for`, `draw_text` or multi-line draw

- [ ] **Step 1: Failing PDF integration test**

In `test_pdf_renderer.py`, add a case that renders with rows having `thanh_tien` (or `tong_tien` field) and asserts:

```python
text = "".join(page.extract_text() or "" for page in PdfReader(BytesIO(pdf)).pages)
assert "Tổng số tiền (Viết bằng chữ):" in text.replace("\n", " ")
```

Also assert that when metadata includes a `tong_tien_bang_chu` field with a distinctive fake value like `SHOULD_NOT_APPEAR`, that string is **absent** from extracted text while the auto prefix **is** present.

Reuse existing metadata fixture patterns in `test_pdf_renderer.py`.

- [ ] **Step 2: Run — expect FAIL** (prefix missing)

- [ ] **Step 3: Implement draw helpers**

```python
def measure_amount_in_words_height(text, font_name, font_size, max_width) -> float:
    if not text:
        return 0.0
    return measure_wrapped_height(
        text, font_name, font_size, max_width, line_height_for(font_size)
    )

def draw_amount_in_words_line(pdf, *, text, x, y_top, max_width, font_size) -> float:
    """Draw bold wrapped lines; return y just below the block."""
    if not text or max_width <= 0:
        return y_top
    gap_before = 6.0
    line_h = line_height_for(font_size)
    lines = wrap_text_to_width(text, FONT_BOLD, font_size, max_width)
    y = y_top - gap_before
    for line in lines:
        y -= line_h
        draw_text(
            pdf,
            x=x,
            y=y,
            text=line,
            font_name=FONT_BOLD,
            font_size=font_size,
            align="left",
            max_width=max_width,
        )
    return y
```

- [ ] **Step 4: Wire `pdf_renderer.py`**

1. In `_draw_static_fields`, skip fields where `should_skip_scalar_field(field.field_name)`.

2. In `render_pdf`, before `plan_pages`:
   - resolve amount + format line (need column metas — use `metadata.table.columns`)
   - `amount_h = measure_amount_in_words_height(...)` (+ `6` gap) or `0`
   - `sig_height = _planner_signature_height(...) + amount_h`

3. In `_draw_page` last-page branch after «Cộng»:
   - `table_left = _table_left(...)`; `table_width = sum(col.width for col in columns)` (use existing width helper if any)
   - `y = draw_amount_in_words_line(...)` when text non-empty
   - `extra_fields = [f for f in metadata.fields if f.below_table and not should_skip_scalar_field(f.field_name)]`
   - `anchor_y = compute_signature_block_anchor_y(y, extra_fields)` then draw signature as today

Pass `fields` into `_draw_page` if not already available for resolve — or resolve once in `render_pdf` and pass `amount_in_words_text: str` into `_draw_page` to avoid double resolve. Prefer **resolve once in `render_pdf`**, pass string into `_draw_page`.

- [ ] **Step 5: Tests PASS**

Run: `./.venv/bin/pytest tests/test_vnd_words.py tests/test_amount_in_words.py tests/test_pdf_renderer.py -q`

- [ ] **Step 6: Commit**

```bash
git add services/document-service/app/render/amount_in_words.py \
  services/document-service/app/render/pdf_renderer.py \
  services/document-service/tests/test_amount_in_words.py \
  services/document-service/tests/test_pdf_renderer.py
git commit -m "feat(document): draw amount-in-words below table on last page"
```

---

### Task 4: Catalog note (optional one-liner) + smoke

**Files:**
- Modify (optional): `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.js` — update label/hint for `tong_tien_bang_chu` to note PDF engine auto-draws the line (Named Range no longer required for PDF).

- [ ] **Step 1: One-line catalog hint** if file already lists the field — keep snake Named Range for Drive compatibility but clarify PDF behavior.

- [ ] **Step 2: Rebuild/restart `document` if needed; run focused pytest in container or host**

```bash
cd services/document-service && ./.venv/bin/pytest tests/test_vnd_words.py tests/test_amount_in_words.py tests/test_pdf_renderer.py -q
```

Expected: all pass.

- [ ] **Step 3: Commit if catalog changed**

```bash
git commit -m "docs(chung-tu): note PDF auto amount-in-words in field catalog"
```

---

## Plan self-review

| Spec requirement | Task |
|------------------|------|
| Auto-draw under «Cộng» last page | 3 |
| Prefix + VND words | 1–2 |
| Prefer tong_tien / else sum | 2 |
| Bold + row_font_size + wrap | 3 |
| Skip Named Range tong_tien_bang_chu | 3 |
| Planner reserve height | 3 |
| Preview inherits (same render_pdf) | 3 (implicit) |
| Node not required | — |
| Catalog note | 4 optional |

No TBD placeholders.
