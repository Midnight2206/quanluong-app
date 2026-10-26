---
name: quanluong-document-exports
description: Work on this repo's Excel and PDF exports in the Python document-service. Use when changing xlsx template import, merged-cell table layout, or phiếu xuất kho PDFs that stamp an e-signature image. Does not replace the Anthropic document skills; those are not vendored here.
---

# Quân lương document exports

Original notes for this repo. The Anthropic docx, pdf, pptx, and xlsx skills are source-available and are not in `.cursor/skills/`. Use this skill and the code it names.

The renderer is the FastAPI app in `services/document-service`. Node (`quanluong-app-be`) calls it. The Next apps do not draw these PDFs. Local health is `GET http://localhost:8000/health` when the dev compose file publishes port 8000. Auth between services is the `X-Service-Key` header (`DOCUMENT_SERVICE_KEY`). Do not commit a real key.

## Excel templates and merged cells

A template is an `.xlsx` (max 5 MB) with named ranges: `FIELD_<name>`, `NL_FIELD_<name>`, `TABLE_HEADER`, `TABLE_DATA_ROW`, and optional `TABLE_SIGNATURE`. Import reads the workbook once (`app/import/template_importer.py`) and stores metadata. Render does not reopen the xlsx.

Merged cells are measured, not guessed:

- `app/import/excel_coords.py` — `merged_range_width_pt`, `merged_range_height_pt`, `enclosing_merge_bounds` from column widths and row heights.
- `app/import/static_cells.py` — walk merge origins only. A `MergedCell` that is not the origin is skipped so a merged title is one field, not one value per cell.
- `app/render/draw.py` — `draw_merged_cell` paints that rectangle (border, wrap, horizontal and vertical align) onto the PDF.

When a table or title looks split, check the merge bounds and the named range, then the draw call. Keep width and height in points consistent between import and `draw_merged_cell`.

## Phiếu xuất kho PDF and e-signature

Category keys include `phieu-xuat-kho` and `lttp-phieu-xuat` (`chung-tu-category.constants.js`). Node builds the payload in `chung-tu-pdf-map.util.js` and copies `signatureImages` to `signature_images` for the document service.

`app/render/signature_block.py` draws the signature block under the table. For each slot it resolves the printed name, then draws a PNG from `signature_images[slot.key]` between the title and the name (default box about 120 by 34 points, offset just under the title). Missing images leave the gap empty; they do not drop the slot. The kitchen month book uses the same image map (`app/render/kitchen_ledger_book.py`).

Tests live next to the service (`pytest` in `services/document-service`, including `test_draw.py` and `test_excel_coords.py`). Change the Python renderer and its test together. Do not add a second PDF stack in Node.
