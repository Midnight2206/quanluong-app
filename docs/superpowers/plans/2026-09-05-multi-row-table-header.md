# Multi-row TABLE_HEADER Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow `TABLE_HEADER` Named Range to span multiple Excel rows; derive columns from the bottom row; resolve titles through vertical merges; keep `TABLE_DATA_ROW` single-row.

**Architecture:** Relax `_merge_groups` for header (scan `max_row`); resolve column title via bottom cell or merge origin; sum row heights for `header_height_pt`. Tests cover 2-row header, vertical merge, horizontal merge, DATA_ROW still single-row.

**Tech Stack:** Python document-service, pytest, openpyxl

**Spec:** `docs/superpowers/specs/2026-09-05-multi-row-table-header-design.md`

## Global Constraints

- `TABLE_HEADER` may be multi-row; `TABLE_DATA_ROW` remains one row
- Column bounds from header `max_row`
- Title: bottom-left of column group; if empty, enclosing merge top-left value
- `header_height_pt` = sum of all header row heights
- Same sheet / column count / column edges vs DATA_ROW
- No new dependencies
- After change: rebuild document-service Docker image (no bind mount)

---

## File Map

| File | Role |
|------|------|
| `services/document-service/app/import/template_importer.py` | `_merge_groups`, title resolve, header height |
| `services/document-service/tests/test_template_importer.py` | New multi-row cases |
| `services/document-service/README.md` | Doc note |
| Optional helper in `excel_coords.py` | `cell_display_value(sheet, row, col)` via merge |

---

### Task 1: Allow multi-row header merge groups + title + height

**Files:**
- Modify: `services/document-service/app/import/template_importer.py`
- Modify: `services/document-service/tests/test_template_importer.py`
- Modify: `services/document-service/README.md` (one line)

**Interfaces:**
- `_merge_groups(sheet, bounds, name, *, allow_multi_row=False)`  
  - if not `allow_multi_row` and `min_row != max_row` → error (DATA_ROW)  
  - if `allow_multi_row`: scan merges on `scan_row = max_row`
- `_header_cell_title(sheet, row, col) -> str` using enclosing merge if value empty
- `parse_template`: call `_merge_groups(..., allow_multi_row=True)` for TABLE_HEADER; title from `max_row`; height sum

- [ ] **Step 1: Failing tests** in `test_template_importer.py`

Add helpers or extend `_add_name` / workbook builders (see `conftest.py` patterns):

```python
def test_table_header_two_rows_imports_keys_from_bottom_row(tmp_path_or_bytes):
    # TABLE_HEADER A5:G6; row5 = group labels; row6 = STT | Tên mặt hàng | ...
    # TABLE_DATA_ROW A7:G7
    # assert column keys match bottom titles; header_height_pt ≈ sum of two row heights

def test_table_header_vertical_merge_reads_title_from_merge_origin():
    # merge A5:A6 with value "STT" in A5; bottom A6 empty
    # assert column key == "stt"

def test_table_data_row_still_rejects_multi_row():
    # TABLE_DATA_ROW spanning 2 rows → TemplateValidationError match "một dòng"
```

Keep existing single-row fixture tests green.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/document-service && python -m pytest tests/test_template_importer.py -q
```

- [ ] **Step 3: Implement**

1. Change `_merge_groups`:

```python
def _merge_groups(sheet, bounds, name, *, allow_multi_row: bool = False):
    min_col, min_row, max_col, max_row = bounds
    if not allow_multi_row and min_row != max_row:
        raise TemplateValidationError(f"Named Range {name} phải nằm trên một dòng")
    scan_row = max_row
    # existing loop but use scan_row instead of min_row for merge membership
```

2. Add:

```python
def _header_cell_title(sheet, row: int, col: int) -> str:
    cell = sheet.cell(row, col)
    raw = "" if cell.value is None else str(cell.value).strip()
    if raw:
        return raw
    merge = enclosing_merge_bounds(sheet, row, col)
    if merge is None:
        return ""
    origin = sheet.cell(merge[1], merge[0])  # min_col, min_row order from enclosing_merge_bounds
    return "" if origin.value is None else str(origin.value).strip()
```

Check `enclosing_merge_bounds` return order: `(min_col, min_row, max_col, max_row)` from tests.

3. In `parse_template` column loop: `header_bottom_row = header_bounds[3]` (max_row); use `_header_cell_title(header_sheet, header_bottom_row, min_col)`; style from title origin cell if needed.

4. `header_height_pt = sum(_row_height_pt(header_sheet, r) or DEFAULT_ROW_HEIGHT_PT for r in range(header_bounds[1], header_bounds[3] + 1))`

5. Call `_merge_groups(header_sheet, header_bounds, "TABLE_HEADER", allow_multi_row=True)`

6. README: `TABLE_HEADER` may span multiple rows; column keys from bottom row; `TABLE_DATA_ROW` single row.

- [ ] **Step 4: Tests PASS**

```bash
cd services/document-service && python -m pytest tests/test_template_importer.py tests/test_pdf_renderer.py -q
```

- [ ] **Step 5: Commit**

```bash
git add services/document-service/app/import/template_importer.py \
  services/document-service/tests/test_template_importer.py \
  services/document-service/README.md
git commit -m "$(cat <<'EOF'
feat(document-service): support multi-row TABLE_HEADER

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| Multi-row HEADER allowed | T1 |
| DATA_ROW single row | T1 |
| Bottom-row column bounds | T1 |
| Vertical merge title | T1 |
| Sum header height | T1 |
| README | T1 |

## Ops

```bash
docker compose build document && docker compose up -d document
```

Re-upload / re-publish templates that use multi-row headers after deploy.
