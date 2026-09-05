# Task 1 Report — Multi-row `TABLE_HEADER` import support

**Status:** completed

## Summary

Implemented Task 1 for multi-row `TABLE_HEADER` import handling in document-service. The importer now derives column groups from the bottom header row, resolves titles through vertical merges when the bottom cell is empty, keeps `TABLE_DATA_ROW` restricted to one row, and sums all header row heights into `header_height_pt`.

## Files modified

| File | Change |
|------|--------|
| `services/document-service/app/import/template_importer.py` | Allowed multi-row header grouping, added merge-aware header title resolution, summed header height across full header bounds |
| `services/document-service/tests/test_template_importer.py` | Added TDD coverage for two-row headers, vertical-merge title fallback, and multi-row `TABLE_DATA_ROW` rejection |
| `services/document-service/README.md` | Documented multi-row `TABLE_HEADER` and single-row `TABLE_DATA_ROW` rules |

## Verification

```bash
/Users/midnight/quanluong-app/services/document-service/.venv/bin/python -m pytest \
  /Users/midnight/quanluong-app/services/document-service/tests/test_template_importer.py \
  /Users/midnight/quanluong-app/services/document-service/tests/test_pdf_renderer.py -q
```

Result: `25 passed`.

## Concerns

1. This task verifies importer and PDF renderer coverage only; no Docker/container runtime validation was run in this session.
2. Existing templates remain compatible, but multi-row headers still assume the bottom header row defines the effective column layout by design.

## Ops note

Document-service Docker image rebuild/restart is still needed after merge/deploy for this change to take effect in containerized environments. It was intentionally not rebuilt in this task.
