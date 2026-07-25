# Thực đơn chi tiết — Thực đơn mẫu cho AI

Ngày: 2026-07-25
Bổ sung cho: `2026-07-24-kitchen-menu-detail-design.md`, `2026-07-24-kitchen-menu-ai-qdrant-addendum.md`

## Mục tiêu

Tab **Thực đơn chi tiết** là nơi user nhập **thực đơn mẫu** để tạo dữ liệu cho AI học — KHÔNG phải sổ thực đơn theo ngày. Mỗi mẫu = một buổi + một mức tiền ăn + các món + LTTP. Ba lựa chọn buổi / mức tiền ăn / đơn vị là metadata đưa vào vector để truy xuất chọn lọc.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Vai trò tab | Nhập **thực đơn mẫu**, tách khỏi sổ thực đơn theo ngày |
| Không có ngày | Bỏ thanh chọn ngày, badge, dòng quân số |
| Phạm vi 1 mẫu | **Một buổi** (Sáng/Trưa/Chiều) + mức tiền ăn + món + LTTP |
| Mức tiền ăn | Chọn từ danh mục **tiêu chuẩn tiền ăn** (`MealAllowanceRate`, `type = an_tieu_chuan`); **khóa số**, không sửa đ/người |
| Mức giá | Không chọn — không dùng loại giá LTTP trên tab này |
| Quân số | Không nhập; chỉ hiện định lượng g-ml/người |
| Lưu trữ | **1 bảng** `KitchenMenuSample`, món/LTTP dạng JSON |
| Áp dụng | Nút **Áp dụng vào ngày…** đẩy sang sổ thực đơn, tái dùng `putMenuPeriod` |
| Vector | 1 point / mẫu; payload lọc theo buổi + mức tiền ăn |

## UI

Thanh trên cùng (dính): Đơn vị · Buổi (nút gạt) · Mức tiền ăn (select danh mục, hiện "25.000 đ/người", số khóa) · nút **Lưu mẫu**.

Thân trang — mỗi món là một thẻ: tên món (gợi ý từ danh mục món) + các dòng LTTP. Mỗi dòng: chọn mặt hàng, ô số, nhãn ĐVT tự suy ra từ mặt hàng (g/người hoặc người/ĐVT), nút xóa dòng. Cuối thẻ "+ Nguyên liệu"; cuối trang "+ Thêm món" và "Chọn từ danh mục".

Dễ dùng: rỗng → hướng dẫn 3 bước + nút chọn danh mục; món thiếu tên / dòng chưa chọn mặt hàng → viền cảnh báo, không chặn; lưu xong báo số mẫu đã có cho buổi+mức; dưới form liệt kê mẫu đã lưu cùng buổi+mức để mở sửa.

## Dữ liệu

`KitchenMenuSample`:
- `id`, `unitId`, `mealPeriod` (enum `KitchenMenuMealPeriod`)
- `mealAllowanceRateId` (FK `MealAllowanceRate`); `mucTienAn` đọc từ DB khi cần, không tin FE
- `dishesJson` (Json): `[{ name, sortOrder, lines: [{ commodityId, calcMode, perPersonAmount, perPersonUnit, peoplePerUnit, sortOrder }] }]`
- `createdById`, `createdAt`, `updatedAt`
- KHÔNG lưu ngày, quân số, giá LTTP
- Index: `@@index([unitId, mealPeriod])`, `@@index([mealAllowanceRateId])`

## API (permission `kitchenBooks.access`, cùng data scope LTTP)

- `GET /kitchen-books/menu-samples?unitId&mealPeriod?&rateId?` — liệt kê, lọc buổi/mức
- `POST /kitchen-books/menu-samples` — tạo (unitId, mealPeriod, rateId, dishes[])
- `PUT /kitchen-books/menu-samples/:id` — sửa
- `DELETE /kitchen-books/menu-samples/:id` — xóa
- `POST /kitchen-books/menu-samples/:id/apply` — body `{ date }`; trả `willOverwrite` nếu ngày+buổi đã có món; tái dùng `putMenuPeriod`

## Vector (Qdrant)

- 1 point / mẫu. Embedding từ tên món + tên LTTP + định lượng.
- Payload lọc: `sampleId`, `unitId`, `mealPeriod`, `mealAllowanceRateId`, `mucTienAn`.
- AI học toàn hệ thống, truy xuất top-K đúng buổi + gần mức tiền ăn.
- DB là nguồn chính; lỗi index nuốt, không chặn lưu (fire-and-forget như menu hiện tại).

## Trạng thái lỗi / biên

- `rateId` sai đơn vị hoặc không phải `an_tieu_chuan` → 400 (`assertMealAllowanceRateIdForUnit`).
- Dòng LTTP không map được `commodityId` trong scope → 400 (validate như menu).
- Món trống tên / mẫu không dòng → 400.
- Áp dụng vào buổi đã có món → `willOverwrite`, FE xác nhận rồi ghi đè.
- Qdrant lỗi/tắt → không ảnh hưởng lưu mẫu.

## Nghiệm thu

- Tạo mẫu buổi trưa mức 25k → xuất hiện đúng bộ lọc buổi/mức.
- Sửa, xóa mẫu đúng.
- Áp dụng mẫu vào một ngày → sổ thực đơn buổi đó có đúng món/LTTP.
- Áp dụng vào buổi đã có món → hỏi xác nhận trước khi ghi đè.
- Self-check BE: build payload vector từ mẫu không ném lỗi khi Qdrant tắt.

## Ngoài phạm vi

Chat AI, kế hoạch LTTP tuần, embedding/search Qdrant thật, backfill, chỉnh định lượng theo trần.
