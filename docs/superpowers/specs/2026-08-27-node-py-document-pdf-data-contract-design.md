# Hợp đồng dữ liệu Node ↔ document-service (PDF)

Ngày: 2026-08-27  
Liên quan: `2026-08-23-chung-tu-document-service-pdf-design.md`, `2026-08-26-document-amount-in-words-below-table-design.md`, `2026-08-26-chung-tu-header-settings-and-field-merge-design.md`  
Branch: `feat/document-service-p4`

## Mục tiêu

Chốt trách nhiệm rõ ràng:

- **Node** gộp nghiệp vụ và quyết định nội dung từng ô / từng dòng bảng.
- **Python (document-service)** chỉ nhận mẫu đã import/publish và **xuất bản PDF** (layout + vài dẫn xuất trình bày đã chốt).

Không đổi hành vi export production trong phạm vi spec này (chỉ tài liệu hóa).

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Phạm vi | Chốt nguyên tắc / hợp đồng; **không** chuyển mang trang hay chữ tiền sang Node |
| Ai quyết định `rows[i]` | **Node** 100% (gộp LTTP, map catalog/alias, thứ tự dòng) |
| Ai quyết định `fields` | **Node** (header, số CT, đơn vị, người mua…) |
| Python với detail rows | Vẽ **đúng payload**; không thêm / sửa / lọc dòng hàng nghiệp vụ |
| Mang trang / Cộng chuyển trang / Cộng | **Python** tự chèn (layout đa trang) |
| Tổng tiền bằng chữ dưới bảng | **Python** tự resolve + vẽ (theo spec 2026-08-26) |
| Phân trang, wrap, font, chữ ký layout | **Python** |
| Preview / demo placeholder | Python được invent **chỉ** trên đường preview/demo, không phải export production |

## Luồng

```
Node
  resolveChungTuContext → detailRows + header context
  getTemplateFields(templateId)
  buildDocumentServicePayload → { fields, rows, signatures?, … }
  POST document-service /documents | /folders/…/documents

Python
  load published template metadata
  render_pdf(fields, rows, …)
    → vẽ FIELD_* từ fields
    → vẽ từng rows[i] as-is
    → (layout) mang trang / Cộng / chữ tiền / chữ ký / phân trang
  → PDF bytes
```

## Hợp đồng payload (production)

Node gửi (rút gọn):

| Khóa | Ai tạo | Ý nghĩa |
|------|--------|---------|
| `fields` | Node | Map tên field mẫu (snake_case) → chuỗi đã format |
| `rows` | Node | Mảng dict; `rows[0]` = dòng 1 bảng dữ liệu, … |
| `signatures` / `signature_dates` | Node/FE | Tên / ngày người ký theo slot |
| `signature_block` | Node (optional) | Override layout chữ ký |

Python **không** được:

- Đổi giá trị ô trong `rows` / `fields` nghiệp vụ
- Thêm dòng hàng từ LTTP / demo vào đường export
- Bỏ qua dòng hàng Node đã gửi (trừ khi tràn trang — vẫn giữ đủ qua nhiều trang)

Python **được** (đã chốt riêng):

- Chèn hàng mang trang / Cộng (không nằm trong `rows` Node)
- Vẽ dòng chữ tiền dưới bảng; bỏ qua scalar `tong_tien_bang_chu` nếu trùng
- Đo chiều cao, wrap, giãn/co layout trong giới hạn mẫu

## Ranh giới “dữ liệu” vs “trình bày”

| Loại | Owner |
|------|--------|
| Nghiệp vụ: mặt hàng, SL, ĐG, thành tiền, đơn vị, ngày, số CT, người mua… | Node |
| Trình bày PDF: vị trí FIELD, độ rộng cột mẫu, phân trang, mang trang, chữ tiền auto, chữ ký | Python |
| Metadata mẫu (Named Range, cột bảng, publish) | Python (import); Node chỉ chọn `templateId` đã publish |

## Ngoài phạm vi

- Chuyển mang trang / chữ tiền sang Node tính sẵn
- Đổi schema payload HTTP
- FE wizard / Drive Sheets
- Thay đổi resolver LTTP

## Tiêu chí xong

1. Spec này được review và commit.
2. Người implement sau này đọc spec biết: **row N do Node**; Py không invent dòng hàng trên export.
3. Không yêu cầu diff code cho milestone này.

## Ghi chú triển khai sau này (không làm ngay)

Nếu cần siết runtime: thêm test “`rows` render as-is” phía document-service; giữ nguyên carry / amount-in-words như hiện tại.
