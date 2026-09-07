# Chứng từ — gộp dòng LTTP theo mặt hàng + đơn giá (Node)

Ngày: 2026-08-27  
Liên quan: `2026-08-27-node-py-document-pdf-data-contract-design.md`, bảng kê mua hàng / PXK / PNK  
Branch: `feat/document-service-p4`

## Vấn đề

`aggregateLinesToDetailRows` đang gộp **chỉ theo mặt hàng** và khi nhiều đơn giá thì lấy **giá trung bình** (`amount / qty`). Sai với nghiệp vụ: cùng giá mới cộng số lượng; khác giá phải thành dòng mới; khác người bán cùng giá thì nối chuỗi tên.

Số chứng từ trên Sheets đã có prefix `Số: `; PDF document-service cần cùng quy tắc khi Node build `fields`.

## Mục tiêu

1. Node gộp dòng chi tiết đúng quy tắc (mọi loại chứng từ dùng chung hàm).
2. Không tính giá trung bình.
3. PDF `soChungTu` / `so` / `soPhieu` mang prefix `Số: ` từ Node.
4. Python chỉ render `rows` / `fields` nhận được (không đổi gộp).

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Phạm vi gộp | **Mọi chứng từ** gọi `aggregateLinesToDetailRows` / `flattenLinesFromSlips` |
| Cùng giá | `unitPrice` **số thực đúng bằng nhau** (`===` sau `Number`, hữu hạn) |
| Key nhóm | `commodityGroupKey(line)` + giá (hoặc sentinel nếu giá không hữu hạn) |
| Cùng key | Cộng `quantity`, `amount`, `requiredQuantity`; `donGia` = `unitPrice` gốc của nhóm |
| Khác giá cùng hàng | **Hai (hoặc nhiều) dòng**; không gộp |
| Người bán | Lấy từ phiếu (`lttpSupplier.name`); nhiều tên trong nhóm → nối `", "` theo thứ tự xuất hiện |
| STT | Đánh lại `1…n` sau gộp |
| Giá trung bình | **Cấm** |
| Gộp theo đơn vị / tháng / ngày | Cùng hàm — key không gồm unitId; khác giá vẫn tách dòng |
| Số chứng từ (PDF) | Node format qua `formatDerivedNamedRangeValue` → `Số: {value}` khi map `fields` |
| Double-prefix | Nếu value đã bắt đầu bằng `Số:` (sau trim) thì không thêm lần nữa |
| Python | Không đổi logic gộp |

## Cột bảng (payload Node → template)

Thứ tự nghiệp vụ chuẩn (map sang column keys mẫu như hiện tại):

| # | fieldKey | Nội dung |
|---|----------|----------|
| 1 | `stt` | Số thứ tự tăng dần từ 1 |
| 2 | `tenHang` | Tên mặt hàng |
| 3 | `dvt` | Đơn vị tính |
| 4 | `nguoiBan` | Người bán trên phiếu (đã nối nếu gộp) |
| … | `soLuong`, `donGia`, `thanhTien`, … | Như catalog hiện tại |

## Thuật toán gộp (Node)

```
groups = ordered Map
for line in rawLines:
  price = Number(line.unitPrice)
  priceKey = Number.isFinite(price) ? String(price) : "__no_price__"
  key = commodityGroupKey(line) + "|" + priceKey
  accumulate qty, amount, requiredQty
  add supplier name (unique, insertion order)
  add line notes
for each group in insertion order:
  mapLineRow with unitPrice = group's price (not amount/qty)
  stt = index + 1
```

## Số chứng từ trên PDF

Khi `buildDocumentServicePayload` / `pickMappedFields` (hoặc điểm map tương đương):

- Với fieldKey `soChungTu`, `so`, `soPhieu`: `formatDerivedNamedRangeValue(fieldKey, raw)`  
- Reuse `chung-tu-named-range-display.js` (đã dùng Sheets)  
- Giá trị rỗng → chuỗi rỗng (không chỉ còn `Số: `)

## Ngoài phạm vi

- Đổi Excel Named Range / import Python  
- Đổi nguồn LTTP (vẫn phiếu nhập xuất như hiện tại)  
- Chuyển mang trang / chữ tiền sang Node  
- Đổi delimiter người bán (giữ `", "`)

## Tiêu chí xong

1. Spec này được review + commit.  
2. Implementation: cùng hàng + cùng `unitPrice` + 2 NCC → 1 dòng, SL/tiền cộng, `nguoiBan` nối.  
3. Cùng hàng + hai `unitPrice` khác nhau → 2 dòng; `donGia` không phải trung bình.  
4. PDF field số chứng từ có prefix `Số: ` (không double).  
5. Test cập nhật/thêm trong `chung-tu-data-resolver.service.test.js` (+ map PDF nếu cần).
