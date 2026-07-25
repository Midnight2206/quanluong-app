# Sổ thực đơn — Thực đơn chi tiết (MVP)

Ngày: 2026-07-24  
Cập nhật: 2026-07-25 — align với thực đơn mẫu (`2026-07-25-kitchen-menu-sample-design.md`)

## Mục tiêu

Bổ sung view **tính tiền + tổng hợp LTTP ngày** trên dữ liệu thực đơn đã lập, thay quy trình Excel thủ công.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Vị trí | Tab chính **Sổ thực đơn** → 3 tab con |
| Tab con | **Thực đơn chi tiết** (mặc định) · **Sổ thực đơn** (bảng tổng hợp theo ngày + giá) · **Kế hoạch LTTP tuần** (placeholder) |
| Thực đơn chi tiết | Form nhập **thực đơn mẫu** (một buổi + mức tiền ăn + món/LTTP) — **không** nhập theo ngày. Chi tiết UI/API/lưu trữ: `2026-07-25-kitchen-menu-sample-design.md` |
| Sổ thực đơn | View theo **ngày** trên `KitchenMenuDay`: xem/tổng hợp món, LTTP, đơn giá thị trường, thành tiền; nhập/sửa thực đơn ngày (hoặc nhận từ **Áp dụng mẫu**) |
| Dữ liệu ngày | `KitchenMenuDay` — mẫu (`KitchenMenuSample`) áp dụng sang ngày qua `putMenuPeriod`; tab Sổ thực đơn đọc/ghi dữ liệu ngày |
| Đơn giá | Tự lấy **giá thị trường** (`unitPrice`) từ bảng giá LTTP hiệu lực theo ngày; không sửa trên tab Sổ thực đơn |
| Layout Sổ thực đơn | Xếp dọc theo bữa + bảng tổng hợp LTTP cuối trang |
| Schema | Không lưu giá trên dòng thực đơn ngày |

## API

- Giữ `GET/PUT /kitchen-books/menu` — phục vụ tab **Sổ thực đơn** (nhập/xem theo ngày).
- `GET /kitchen-books/menu/detail?unitId&date` — phục vụ tab **Sổ thực đơn** (tính tiền + tổng hợp LTTP):
  - Permission `kitchenBooks.access`, cùng data scope LTTP.
  - Mỗi dòng: `unitPrice`, `lineAmount` (null nếu thiếu giá).
  - Mỗi bữa: `mealAmount`, `missingPriceCount`.
  - Ngày: `dayAmount`, `missingPriceCount`, `appliedPriceTableId`, `appliedEffectiveDate`.
  - `commodityTotals[]`: gộp theo `commodityId` (SL, ĐG, thành tiền).
- CRUD/apply mẫu: `GET/POST/PUT/DELETE /kitchen-books/menu-samples`, `POST .../apply` — xem spec 2026-07-25.

## Ngoài phạm vi MVP

- Kế hoạch LTTP tuần thật, xuất Excel/PDF, sửa giá trên tab Sổ thực đơn, chọn TGSX.
