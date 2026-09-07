# Task 1 Report — Excel Faithful Merges

**Status:** DONE  
**Commit:** Pending at write time

## Implemented

- Rewrote `services/document-service/app/import/static_cells.py` so static cells are emitted once per merge origin instead of once per scanned row.
- Added `iter_static_merge_origins(...)` using `enclosing_merge_bounds(...)` and full merge geometry via `merged_range_width_pt(...)` and `merged_range_height_pt(...)`.
- Kept existing skip behavior for `FIELD_*` / `NL_FIELD_*` coverage and excluded any static cell whose merge intersects `TABLE_DATA_ROW`.
- Applied the same origin-based path to header, body, and signature layers because targeted regressions stayed green.
- Added a PNK-like 2-row header fixture covering `TT`, merged `Số lượng`, and `Yêu cầu` / `Thực nhập`.
- Added regression assertions for full-height vertical merge metadata and continuation-page PDF header labels.

## Tests

```bash
cd services/document-service && .venv/bin/python -m pytest tests/test_template_importer.py tests/test_pdf_renderer.py -q
```

Result: `30 passed`

## Concerns

None blocking for Task 1. I did not rebuild Docker per request, so uploaded templates will use the new merge-origin metadata only after the document service is rebuilt outside this task.
