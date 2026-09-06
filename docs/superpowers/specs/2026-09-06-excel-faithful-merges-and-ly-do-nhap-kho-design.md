# Design Spec: Excel-faithful merges + PNK lý do nhập kho

**Date:** 2026-09-06  
**Status:** Draft for review  
**Feature:** (A) Static cells theo merge origin để PDF khớp Excel; (B) `FIELD_ly_do_nhap_kho` giống `nhapTaiKho`

---

## 1. Problem

### A — Header / static merge

- Mẫu PNK (và template khác) dùng merge **dọc + ngang** trong `TABLE_HEADER` (TT rowspan 2; “Số lượng” colspan 2 + Yêu cầu/Thực nhập).
- `collect_static_cells` hiện emit theo **từng hàng Excel** với `height_pt = row_height` và bỏ `MergedCell` → ô merge dọc chỉ cao 1 hàng → PDF header vỡ (text lệch, ô dưới trống, “Số lượng”/subcolumn lệch).
- Cần phương án **tổng quát**: mọi mẫu upload vẽ static đúng geometry Excel (không chỉ hardcode PNK).

### B — Lý do nhập kho

- PNK cần scalar “Lý do nhập kho” song song “Nhập tại kho” (user nhập, lưu settings, Named Range trên mẫu).

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| A1 | Thuật toán chung: **một merge origin (hoặc ô đơn) → một `StaticCellMeta`** với `width_pt` × `height_pt` = full merge |
| A2 | Bỏ emit theo “một hàng = một height” cho ô đã merge dọc |
| A3 | Ship: **header band đúng bắt buộc**; cùng helper mở rộng **body + signature** trong cùng PR nếu regression pass |
| A4 | Skip: `TABLE_DATA_ROW`, coords `FIELD_*` / `NL_FIELD_*` |
| A5 | Layer vẫn theo vị trí origin (header / body / signature) |
| A6 | Không đổi quy ước cột data (vẫn suy từ hàng dưới `TABLE_HEADER`) |
| A7 | Ngoài scope: ảnh/chart/CF; font không embed; pixel-perfect tuyệt đối |
| B1 | Named Range `FIELD_ly_do_nhap_kho` → key `lyDoNhapKho` |
| B2 | Giống `nhapTaiKho`: UI chữ ký / `extraFields`, catalog `supportsLabel: true`, forward export |
| B3 | Không dùng `NL_FIELD` cho lý do |

---

## 3. Part A — Document-service

### 3.1 Helper (dùng chung)

Trong `static_cells.py` (hoặc module nhỏ cạnh đó), vd. `iter_static_merge_origins(sheet, *, col_min, col_max, row_min, row_max)`:

```text
visited = set()
for row in [row_min..row_max]:
  for col in [col_min..col_max]:
    cell = sheet.cell(row, col)
    if MergedCell: continue
    bounds = enclosing_merge or (col,row,col,row)
    key = (bounds.min_row, bounds.min_col)
    if key in visited: continue
    visited.add(key)
    yield origin cell + full bounds
```

Geometry:

- `x, y_top` từ góc trên-trái merge (row=`min_row`, col=`min_col`)
- `width_pt = merged_range_width_pt(...)`
- `height_pt = merged_range_height_pt(...)`
- `y` (đáy cell trong meta) = `y_top - height_pt`
- value / font / align / border từ ô gốc

### 3.2 `collect_static_cells`

- Thay vòng `_row_groups` + `row_height` bằng emit từ merge origins trên phạm vi sheet (trừ data row).
- Cột quét: giữ `header_min_col..header_max_col` như hiện tại (table width), trừ khi body cần cột ngoài — **YAGNI:** giữ cùng cột table; body/signature trong band cột bảng.
- Header origins có `min_row..max_row` giao `header_bounds` → `layer="header"`.
- Body/signature: cùng path; chỉ ship nếu tests (minimal + multi-row header PDF) xanh.

### 3.3 Render

- Không đổi API `_draw_table_header` nếu geometry đúng.
- Regression: continuation pages vẫn lặp header_cells đầy đủ (đã có test multi-row; bổ sung assert height TT merge).

### 3.4 Tests

1. Fixture 2-row header: TT merge A5:A6; Số lượng B5:C5 ngang; Yêu cầu/Thực nhập hàng 6.
2. Static cell TT: `height_pt ≈ h5+h6`; value `"TT"`.
3. Static “Số lượng”: `width_pt` ≈ 2 cols.
4. PDF multi-page: text TT / Số lượng / Yêu cầu / Thực nhập trên trang 2.
5. Minimal 1-row header không regress.

### 3.5 Ops

```bash
docker compose build document && docker compose up -d document
```

Re-upload mẫu nếu metadata cũ thiếu geometry mới (upload lại sau rebuild).

---

## 4. Part B — PNK lý do nhập kho

### 4.1 Catalog / resolve

- Catalog: `FIELD_ly_do_nhap_kho`, `lyDoNhapKho`, `supportsLabel: true`.
- Alias: `ly_do_nhap_kho` → `lyDoNhapKho`.

### 4.2 UI + persist

- `ChungTuSignatureSettingsWorkspace`: input cạnh `nhapTaiKho` trong `extraFields.lyDoNhapKho`.
- Zod / normalize giống `nhapTaiKho`.

### 4.3 Export path

- Batch/export: đọc `extraFields.lyDoNhapKho` → resolver/context → `pickMappedFields` (cùng pattern `nhapTaiKho`).

### 4.4 Tests

- Catalog + resolve key.
- Signature workspace source/API assert.
- Export batch forwards `lyDoNhapKho` (mirror nhapTaiKho test).

---

## 5. Out of scope

- Đổi mapping cột `yeu_cau` / `thuc_nhap` nghiệp vụ (chỉ fidelity vẽ).
- Drive Sheets named ranges.
- Pixel-perfect font metrics ngoài ReportLab hiện có.

---

## 6. Acceptance

**A**

1. Upload mẫu header như screenshot PNK → PDF header khớp merge (TT cao 2 hàng; Số lượng rộng 2 cột; Yêu cầu/Thực nhập đúng chỗ).
2. Mẫu 1 dòng cũ không regress.
3. Document image rebuild sau merge.

**B**

1. Đặt `FIELD_ly_do_nhap_kho` trên mẫu → PDF hiện đúng text đã lưu.
2. UI lưu/đọc `extraFields.lyDoNhapKho`.
3. Catalog tra cứu thấy field.
