# Addendum: Qdrant RAG + căn mức tiền ăn (khung)

Ngày: 2026-07-24  
Bổ sung cho: `2026-07-24-kitchen-menu-ai-suggest-design.md`

## Ưu tiên sản phẩm

1. **Ship Sổ thực đơn + Thực đơn chi tiết** để user nhập/xem mẫu → tích lũy `KitchenMenuDay`.
2. **Khung Qdrant** (Docker + client stub + hook index sau khi lưu) — retrieval/căn tiền đầy đủ làm phase sau khi có dữ liệu.

## Đã chốt (phase vector + tiền)

| Chủ đề | Quyết định |
|--------|------------|
| Vector store | **Qdrant** (Docker) |
| Đơn vị index | **1 point / ngày** (3 bữa) |
| Retrieval | top-K ngày tương tự (+ ưu tiên cùng thứ) thay vì nhồi toàn bộ lịch sử |
| Trần chi phí | Mức tiền ăn **đ/người** — chọn từ `MealAllowanceRate`, cho sửa số trước khi AI |
| Giá | `getEffectivePrices` ngày thực đơn (thị trường); BE tính tiền, không tin giá do LLM bịa |
| Chỉnh định lượng | BE scale / vòng LLM có số liệu nếu vượt trần suất × mức |

## Khung MVP (phase này)

- Service `qdrant` trong compose; env `QDRANT_URL` (trống = tắt).
- Module stub: `upsertMenuDayVector` / `searchSimilarMenuDays` — no-op khi tắt; chưa gọi embedding API.
- Sau `putMenu` / `ai-apply`: fire-and-forget upsert (nuốt lỗi, không chặn lưu).
- Chưa: backfill, embedding, đổi `suggestMenuDay` sang Qdrant, UI mức tiền trên dialog AI.

## Ngoài phạm vi khung

Chat (C), kế hoạch tuần (B), fine-tune.
