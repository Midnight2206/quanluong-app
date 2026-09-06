# Excel-faithful merges + PNK lý do nhập kho Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) Collect static cells by Excel merge origin so PDF headers/body match uploaded templates; (B) Add PNK `FIELD_ly_do_nhap_kho` / `lyDoNhapKho` like `nhapTaiKho`.

**Architecture:** Replace per-row `collect_static_cells` emission with merge-origin iteration (`merged_range_width_pt` × `merged_range_height_pt`). Mirror `nhapTaiKho` for lý do across catalog, UI `extraFields`, and export.

**Tech Stack:** Python document-service + pytest; Node ESM + `node:test`; React shared package

**Spec:** `docs/superpowers/specs/2026-09-06-excel-faithful-merges-and-ly-do-nhap-kho-design.md`

## Global Constraints

- One merge origin → one `StaticCellMeta` with full merge geometry
- Header band must be correct; body/signature use same helper if regressions pass
- Skip `TABLE_DATA_ROW` and `FIELD_*` / `NL_FIELD_*` coords
- Column keys still from bottom `TABLE_HEADER` row (unchanged)
- `FIELD_ly_do_nhap_kho` → `lyDoNhapKho`, labelable, not `NL_FIELD`
- No new dependencies
- Rebuild document image after Part A

---

## File Map

| File | Role |
|------|------|
| `services/document-service/app/import/static_cells.py` | `iter_static_merge_origins` + rewrite `collect_static_cells` |
| `services/document-service/tests/test_template_importer.py` | PNK-like 2-row merge fixture + height/width asserts |
| `services/document-service/tests/test_pdf_renderer.py` | Continuation-page header text regression |
| `quanluong-app-be/.../chung-tu-pdf-field-catalog.js` | Catalog row |
| `chung-tu-pdf-column-alias.util.js` / FE resolve | Alias `ly_do_nhap_kho` |
| `ChungTuSignatureSettingsWorkspace.jsx` | UI + zod `extraFields.lyDoNhapKho` |
| `chung-tu-data-resolver.service.js` + export-batch | Forward `lyDoNhapKho` |
| Matching `*.test.js` | Catalog, resolve, batch, page source |

---

### Task 1: Merge-origin static cells (document-service)

**Files:**
- Modify: `services/document-service/app/import/static_cells.py`
- Modify: `services/document-service/tests/test_template_importer.py`
- Modify: `services/document-service/tests/test_pdf_renderer.py` (if needed)
- Optional README one-liner

**Interfaces:**
- Produces: `collect_static_cells(...)` emits full-merge geometry for header (and body/signature via same path)

- [ ] **Step 1: Failing tests**

Add helper fixture (in `test_template_importer.py` or conftest) building:

- `TABLE_HEADER` `$A$5:$G$6`, `TABLE_DATA_ROW` `$A$7:$G$7`
- Merge `A5:A6` = `"TT"`; `B5:B6` = long name title; `C5:C6` = `"ĐVT"`
- Merge `D5:E5` = `"Số lượng"`; `D6`=`"Yêu cầu"`; `E6`=`"Thực nhập"`
- Merge `F5:F6`=`"Đơn giá"`; `G5:G6`=`"Thành tiền"`
- Row heights 5=20, 6=24

```python
def test_header_vertical_merge_static_cell_uses_full_height():
    metadata = _parse_template(_make_pnk_like_two_row_header())
    tt = next(c for c in metadata.static_cells if c.layer == "header" and c.value == "TT")
    assert tt.height_pt == 44  # 20+24
    so_luong = next(c for c in metadata.static_cells if c.value == "Số lượng")
    assert so_luong.width_pt > tt.width_pt  # spans 2 cols
```

Extend PDF test (or new) so multi-page render includes `"TT"`, `"Số lượng"`, `"Yêu cầu"`, `"Thực nhập"` on page 2.

Keep existing multi-row / minimal tests green.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/document-service && .venv/bin/python -m pytest \
  tests/test_template_importer.py tests/test_pdf_renderer.py -q
```

Expected: TT `height_pt` still single-row (~20).

- [ ] **Step 3: Implement**

In `static_cells.py`:

1. Import `enclosing_merge_bounds`, `merged_range_height_pt` from `excel_coords`.
2. Add `iter_static_merge_origins(sheet, *, min_col, max_col, min_row, max_row)` per spec (visited set; skip `MergedCell`; yield `(min_col, min_row, max_col, max_row)` + origin cell).
3. Rewrite `collect_static_cells`:
   - Skip entire `data_row`.
   - Iterate origins for `row in 1..max_row`, `col in header_min_col..header_max_col` (or per-band loops), **excluding** any origin whose rows include only data_row — skip if origin intersects data_row as the sole content row, or skip origins with `min_row == max_row == data_row`.
   - Skip if `(origin_row, origin_col)` in `field_coords`.
   - Layer from `origin_row` (or `min_row` of merge) vs header/data bounds (same rules as today).
   - Geometry: full merge width/height; `y = y_top - height_pt`.
   - Keep skip empty value without visible border.

**ponytail:** Prefer one sheet-wide origin pass then assign layer; if body/signature regressions appear, keep header-band origin pass first and only enable body/signature when green.

- [ ] **Step 4: Tests PASS**

```bash
cd services/document-service && .venv/bin/python -m pytest \
  tests/test_template_importer.py tests/test_pdf_renderer.py -q
```

- [ ] **Step 5: Commit**

```bash
git add services/document-service/app/import/static_cells.py \
  services/document-service/tests/test_template_importer.py \
  services/document-service/tests/test_pdf_renderer.py
git commit -m "$(cat <<'EOF'
fix(document-service): emit static cells from Excel merge origins

EOF
)"
```

---

### Task 2: PNK `lyDoNhapKho` (catalog → export → UI)

**Files:**
- Modify: `chung-tu-pdf-field-catalog.js` (+ test)
- Modify: `chung-tu-pdf-column-alias.util.js` (+ test) — alias `ly_do_nhap_kho`
- Modify: FE `chungTuPdfScalarFieldKey.js` / `chungTuLabelField.js` alias if needed
- Modify: `chung-tu-data-resolver.service.js` — plumb `lyDoNhapKho` like `nhapTaiKho` on PNK contexts
- Modify: `chung-tu-pdf-export-batch.service.js` (+ test) — `extraFields.lyDoNhapKho`
- Modify: `ChungTuSignatureSettingsWorkspace.jsx` (+ page test) — input + zod
- Grep `nhapTaiKho` call chain and mirror for `lyDoNhapKho` (controller already accepts `extraFields` record)

**Interfaces:**
- Consumes: existing `extraFields` persistence
- Produces: context/export field `lyDoNhapKho`

- [ ] **Step 1: Failing tests**

```js
// catalog
assert.equal(
  scalarFields.find((f) => f.namedRange === "FIELD_ly_do_nhap_kho").fieldKey,
  "lyDoNhapKho",
);
assert.equal(resolveScalarFieldKey("FIELD_ly_do_nhap_kho"), "lyDoNhapKho");

// export-batch mirror nhapTaiKho test with lyDoNhapKho
// ChungTuQuyetToanPage / signature workspace source: lyDoNhapKho + label "Lý do nhập kho"
```

- [ ] **Step 2: Implement minimal mirror of `nhapTaiKho` path.**

- [ ] **Step 3: Run targeted BE + shared tests — PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): add PNK lyDoNhapKho field like nhapTaiKho

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| Merge-origin static cells | T1 |
| Header fidelity + PDF regression | T1 |
| Body/signature same helper | T1 (if green) |
| `FIELD_ly_do_nhap_kho` / UI / export | T2 |

## Ops

```bash
docker compose build document && docker compose up -d document
```

Re-upload PNK Excel template after document rebuild; add Named Range `FIELD_ly_do_nhap_kho`.
