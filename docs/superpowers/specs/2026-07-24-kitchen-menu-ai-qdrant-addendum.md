# Addendum: Qdrant RAG + căn mức tiền ăn (khung)

Ngày: 2026-07-24  
Cập nhật: 2026-07-25 — thêm index thực đơn mẫu  
Bổ sung cho: `2026-07-24-kitchen-menu-ai-suggest-design.md`

## Ưu tiên sản phẩm

1. **Ship Sổ thực đơn + Thực đơn chi tiết** (form mẫu) để user nhập mẫu → tích lũy `KitchenMenuSample` và `KitchenMenuDay`.
2. **Khung Qdrant** (Docker + client stub + hook index sau khi lưu) — retrieval/căn tiền đầy đủ làm phase sau khi có dữ liệu.

## Đã chốt (phase vector + tiền)

| Chủ đề | Quyết định |
|--------|------------|
| Vector store | **Qdrant** (Docker) |
| Đơn vị index — ngày | **1 point / ngày** (3 bữa) trên `KitchenMenuDay` |
| Đơn vị index — mẫu | **1 point / mẫu** trên `KitchenMenuSample` (buổi + mức tiền ăn + món/LTTP) |
| Collection | Riêng `kitchen_menu_samples` **hoặc** chung collection với payload `kind=sample\|day` |
| Retrieval | top-K ngày/mẫu tương tự (+ ưu tiên cùng thứ / cùng buổi + gần mức tiền ăn) thay vì nhồi toàn bộ lịch sử |
| Trần chi phí | Mức tiền ăn **đ/người** — chọn từ `MealAllowanceRate`, cho sửa số trước khi AI (trên flow gợi ý ngày; mẫu khóa mức — xem spec 2026-07-25) |
| Giá | `getEffectivePrices` ngày thực đơn (thị trường); BE tính tiền, không tin giá do LLM bịa |
| Chỉnh định lượng | BE scale / vòng LLM có số liệu nếu vượt trần suất × mức |

## Khung MVP (phase này)

- Service `qdrant` trong compose; env `QDRANT_URL` (trống = tắt).
- Module stub: `upsertMenuDayVector` / `searchSimilarMenuDays` và `upsertMenuSampleVector` / `searchSimilarMenuSamples` — no-op khi tắt; chưa gọi embedding API.
- Sau `putMenu` / `ai-apply`: fire-and-forget upsert ngày (nuốt lỗi, không chặn lưu).
- Sau create/update mẫu: fire-and-forget upsert mẫu (cùng pattern).
- Chưa: backfill, embedding, đổi `suggestMenuDay` sang Qdrant, UI mức tiền trên dialog AI.

## Ngoài phạm vi khung

Chat (C), kế hoạch tuần (B), fine-tune.
