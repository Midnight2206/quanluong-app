# Document-service — dòng tổng tiền bằng chữ dưới bảng

Ngày: 2026-08-26  
Liên quan: `2026-08-23-chung-tu-document-service-pdf-design.md`, `2026-08-25-chung-tu-pdf-template-draft-preview-publish-design.md`  
Branch: `feat/document-service-p4`

## Vấn đề

Tổng thành tiền bằng chữ đã có ở tầng Node (`tongTienBangChu` / `vndToVietnameseDocumentLine`) và trên Drive Sheets (prefix `Tổng số tiền (Viết bằng chữ): …`). Trên PDF document-service, vị trí phụ thuộc Named Range Excel — lệch ô hoặc thiếu field → PDF sai / thiếu dòng. Cần **luôn** hiện ngay dưới bảng, font chung, in đậm.

## Mục tiêu

Document-service **tự vẽ** một dòng tổng tiền bằng chữ ngay dưới bảng dữ liệu (trang cuối), không phụ thuộc Named Range `FIELD_tong_tien_bang_chu`.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Ai vẽ | Document-service renderer (không bắt buộc đổi Node/FE) |
| Vị trí | Trang cuối: sau hàng «Cộng», trước chữ ký / field `below_table` còn lại |
| Prefix | `Tổng số tiền (Viết bằng chữ): ` + chuỗi từ util (đã gồm «đồng», hoa chữ đầu) |
| Nguồn số | Ưu tiên `fields.tong_tien` / `tong_tien_so` (parse số); không có → cộng cột bảng (`thanh_tien` / alias như carry totals) |
| Chữ | Luôn sinh trong DS (không tin chuỗi `tong_tien_bang_chu` từ client) |
| Named Range cũ | **Bỏ qua** khi vẽ scalar `tong_tien_bang_chu` (tránh trùng) |
| Style | `FONT_BOLD`, size = `row_font_size` bảng; căn trái mép bảng; wrap trong bề rộng bảng |
| Không có số hợp lệ | Không vẽ dòng |

## Kiến trúc

```
render last page
  … table rows …
  draw «Cộng» (carry)
  resolve amount (fields.tong_tien | sum rows)
  if amount known:
    text = "Tổng số tiền (Viết bằng chữ): " + vnd_to_vietnamese(amount)
    draw bold @ row_font_size below table; y advances
  draw signature / remaining below_table (tong_tien_bang_chu skipped in static fields)
```

## Module

| File | Responsibility |
|------|----------------|
| `app/render/vnd_words.py` | Port logic `vndToVietnameseDocumentLine` từ Node |
| `app/render/amount_in_words.py` | Resolve amount, format line, draw + return height consumed |
| `app/render/pdf_renderer.py` | Hook sau «Cộng»; skip field `tong_tien_bang_chu` trong `_draw_static_fields`; reserve height trên trang cuối cho planner nếu cần |
| Tests | Unit đọc số; PDF chứa prefix; Named Range bị skip |

## Chi tiết hành vi

### Resolve amount

1. Nếu `fields` có `tong_tien` hoặc `tong_tien_so`: `parse_amount` → dùng nếu `>= 0` và parse được (kể cả 0).
2. Else: `find_amount_column_key` + `sum_amount(rows, …)` như `carry_totals`.
3. Không resolve được → skip draw.

### Format

```
Tổng số tiền (Viết bằng chữ): {vnd_to_vietnamese(amount)}
```

Ví dụ: `Tổng số tiền (Viết bằng chữ): Một trăm nghìn đồng`

### Skip Named Range

Trong `_draw_static_fields` (và mọi path vẽ scalar tương đương): bỏ qua `field_name` thuộc tập  
`{"tong_tien_bang_chu"}` (chuẩn hóa lower/snake). Field vẫn có thể tồn tại trong metadata import — chỉ không vẽ.

### Pagination

Dòng chữ chiếm chiều cao thật (1–N dòng sau wrap). Planner trang cuối phải dành đủ chỗ (cùng cơ chế khoảng dưới bảng / signature) để không chồng chữ ký.

## Node / catalog

- Không bắt buộc đổi export mapper: tiếp tục gửi `tong_tien` khi có.
- Catalog / gợi ý Superadmin: ghi chú dòng bằng chữ do engine PDF tự vẽ; Named Range `FIELD_tong_tien_bang_chu` không còn cần cho PDF mới.

## Preview

`GET …/preview` dùng cùng `render_pdf` → dòng auto xuất hiện với dữ liệu mẫu (cộng rows / field mẫu).

## Ngoài phạm vi

- Drive / Google Sheets path (đã có `formatDerivedNamedRangeValue`)
- UI bật/tắt dòng
- Đa ngôn ngữ
- Persist cấu hình riêng trên template

## Tiêu chí xong

1. PDF trang cuối luôn có dòng prefix đúng format dưới «Cộng», bold, font size bảng.
2. Có `FIELD_tong_tien_bang_chu` trên template → không vẽ trùng từ Named Range.
3. Unit tests đọc số khớp case Node hiện có; ít nhất một test render kiểm tra chuỗi prefix trong PDF text extract hoặc draw spy.
