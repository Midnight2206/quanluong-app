# Design Spec: Multi-row TABLE_HEADER

**Date:** 2026-09-05  
**Status:** Draft for review  
**Feature:** Cho phép Named Range `TABLE_HEADER` chiếm nhiều dòng Excel; suy cột từ hàng dưới cùng; đọc title qua merge dọc

---

## 1. Problem

- Document-service hiện **từ chối** `TABLE_HEADER` nhiều dòng (`_merge_groups`: “phải nằm trên một dòng”).
- Title / `header_height_pt` chỉ lấy **một** hàng đầu → mẫu header 2+ dòng không import được hoặc cao sai.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | `TABLE_HEADER` được phép nhiều dòng |
| 2 | `TABLE_DATA_ROW` vẫn **một** dòng |
| 3 | Biên cột suy từ **hàng dưới cùng** (`max_row`) của `TABLE_HEADER` |
| 4 | Title/key: ô `(max_row, min_col)` của nhóm cột; nếu trống → value ô gốc của merge bao ô đó |
| 5 | `header_height_pt` = tổng chiều cao mọi hàng trong bounds header |
| 6 | Vẫn cùng sheet / cùng số cột / cùng biên cột với `TABLE_DATA_ROW` |

---

## 3. Import changes (`template_importer.py`)

### 3.1 `_merge_groups`

- Thêm tham số hoặc tách helper: với `TABLE_DATA_ROW` giữ `min_row == max_row`.
- Với `TABLE_HEADER`: cho phép `min_row < max_row`; scan merge ngang trên **`scan_row = max_row`** (hàng dưới cùng) trong `[min_col, max_col]`.
- Merge vượt biên Named Range → lỗi như hiện tại.

### 3.2 Column title

```text
for each (min_col, max_col) in header_groups:
  cell = sheet.cell(max_row, min_col)
  title = cell.value
  if empty:
    merge = enclosing_merge_bounds(sheet, max_row, min_col)
    if merge: title = sheet.cell(merge.min_row, merge.min_col).value
  slug(title) → key  # unchanged
```

Align/font cho metadata cột: ưu tiên ô có title (ô gốc merge nếu dùng).

### 3.3 Heights

- `header_height_pt = sum(_row_height_pt(sheet, r) for r in range(min_row, max_row+1))`
- `static_block_height_pt`: vẫn neo theo layout hiện tại; đảm bảo không cắt ngắn khối header nhiều dòng (verify với `collect_static_cells` / `header_bounds` full range).

### 3.4 Render

- Dùng `table.header_height_pt` đã tính đủ nhiều hàng.
- Path vẽ `header_cells` trong vùng header giữ nguyên nếu static cells cover multi-row text; fallback single-row title draw chỉ khi không có header_cells.

---

## 4. Docs

- Cập nhật README document-service: `TABLE_HEADER` có thể nhiều dòng; `TABLE_DATA_ROW` một dòng.
- Ghi chú catalog/tra cứu nếu có hint “1 dòng” → sửa.

---

## 5. Tests

1. Header 2 dòng, không merge dọc → import OK; keys từ hàng dưới; height ≈ 2 rows.
2. Cột merge dọc toàn header → title lấy từ ô gốc merge; key hợp lệ.
3. Merge ngang trên hàng dưới → nhóm cột đúng; khớp DATA_ROW.
4. `TABLE_DATA_ROW` 2 dòng → vẫn `TemplateValidationError`.
5. Regression: header 1 dòng như fixture cũ vẫn pass.

---

## 6. Out of scope

- Multi-row `TABLE_DATA_ROW`
- Đổi quy ước Named Range (`TABLE_HEADER_1`…)
- Sửa Node mapping cột (vẫn theo `key` slug từ title)

---

## 7. Acceptance

1. Upload mẫu `TABLE_HEADER` = `$A$5:$G$6` (2 dòng) thành công.
2. PDF header cao đúng 2 dòng; cột map đúng từ title hàng dưới / merge.
3. Mẫu 1 dòng cũ không regress.
4. Rebuild/restart document-service image sau merge (không bind-mount source).
