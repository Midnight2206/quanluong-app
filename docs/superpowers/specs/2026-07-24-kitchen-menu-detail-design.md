# Sổ thực đơn — Thực đơn chi tiết (MVP)

Ngày: 2026-07-24

## Mục tiêu

Bổ sung view **tính tiền + tổng hợp LTTP ngày** trên dữ liệu thực đơn đã lập, thay quy trình Excel thủ công.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Vị trí | Tab chính **Sổ thực đơn** → 3 tab con |
| Tab con | **Thực đơn chi tiết** (mặc định) · **Sổ thực đơn** (UI lập món hiện tại) · **Kế hoạch LTTP tuần** (placeholder) |
| Dữ liệu | Cùng `KitchenMenuDay` — sửa ở Sổ thực đơn, chi tiết chỉ đọc |
| Đơn giá | Tự lấy **giá thị trường** (`unitPrice`) từ bảng giá LTTP hiệu lực theo ngày; không sửa trên tab chi tiết |
| Layout | Xếp dọc theo bữa + bảng tổng hợp LTTP cuối trang |
| Schema | Không lưu giá trên dòng thực đơn |

## API

- Giữ `GET/PUT /kitchen-books/menu`.
- Thêm `GET /kitchen-books/menu/detail?unitId&date`:
  - Permission `kitchenBooks.access`, cùng data scope LTTP.
  - Mỗi dòng: `unitPrice`, `lineAmount` (null nếu thiếu giá).
  - Mỗi bữa: `mealAmount`, `missingPriceCount`.
  - Ngày: `dayAmount`, `missingPriceCount`, `appliedPriceTableId`, `appliedEffectiveDate`.
  - `commodityTotals[]`: gộp theo `commodityId` (SL, ĐG, thành tiền).

## Ngoài phạm vi MVP

- Kế hoạch LTTP tuần thật, xuất Excel/PDF, sửa giá trên tab, chọn TGSX.
