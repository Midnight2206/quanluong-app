# AI gợi ý thực đơn 1 ngày (phần A)

Ngày: 2026-07-24

## Bối cảnh

Users đang lập thực đơn thủ công (Excel / Sổ thực đơn). Muốn **AI agent** hỗ trợ lập kế hoạch, học từ thực đơn đã nhập. Roadmap đầy đủ: **A** gợi ý 1 ngày → **C** chat hỏi–đáp → **B** kế hoạch tuần. Spec này chỉ **phần A**.

## Mục tiêu

Nút **«AI gợi ý ngày»** trên tab **Sổ thực đơn**: xem trước 3 buổi (món + LTTP + định lượng) → xác nhận → ghi vào `KitchenMenuDay` của đơn vị/ngày đang chọn.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Phạm vi học | **Toàn hệ thống** (mọi `KitchenMenuDay`) |
| Cách học MVP | **RAG / context prompt** — không fine-tune; lộ trình sau mới train nếu cần |
| Áp dụng | Dialog xem trước → **Áp dụng cả 3 buổi**; confirm nếu ngày đã có món |
| Chi tiết gợi ý | Tên món + dòng LTTP + định lượng (cùng shape Sổ thực đơn) |
| Kiến trúc | **BE agent** gọi LLM; API key chỉ trên server |
| UI | Nút trên tab **Sổ thực đơn** (không đặt trên Thực đơn chi tiết) |

## Ngoài phạm vi (YAGNI phần A)

- Chat trợ lý (C), kế hoạch tuần (B), fine-tune / vector DB
- Sửa chi tiết trong dialog trước khi áp dụng (sửa sau ở Sổ thực đơn)
- Chọn TGSX / tính tiền trong bước AI (dùng Thực đơn chi tiết sau khi đã lưu)

## UX

1. User chọn đơn vị + ngày trên **Sổ thực đơn**.
2. Bấm **AI gợi ý ngày** → loading.
3. Dialog preview: Sáng / Trưa / Chiều; mỗi dòng có trạng thái map LTTP; `warnings[]`.
4. **Áp dụng** → confirm nếu đã có món → ghi DB.
5. **Hủy** → không đổi.

**Áp dụng khi có dòng chưa map:** chỉ ghi dòng đã `mapped`; báo số dòng bỏ qua toast/dialog.

## API

Permission: `kitchenBooks.access`. Cùng `unitDataScopeMiddleware` (LTTP).

### `POST /kitchen-books/menu/ai-suggest`

Body: `{ unitId, date }`

Response (ý):

- `periods.sang|trua|chieu`: `{ dishes: [{ name, lines: [{ commodityId, commodityName, calcMode, perPersonAmount, perPersonUnit, peoplePerUnit, mapped }] }] }`
- `warnings: string[]`
- `meta`: `{ historySampleCount, appliedPriceTableId? }` (meta giá không bắt buộc)

### `POST /kitchen-books/menu/ai-apply`

Body: `{ unitId, date, periods }` (cùng shape sau khi FE gửi lại preview đã duyệt)

- Validate: mọi `commodityId` thuộc `storageUnitId` hiện tại; bỏ / reject dòng `commodityId` null.
- Ghi 3 buổi bằng logic tương đương `putMenu` (transaction hoặc lần lượt có rollback rõ).

## RAG MVP (chưa vector DB)

1. Lấy mẫu thực đơn toàn hệ thống (khoảng 30–60 ngày gần; ưu tiên cùng thứ trong tuần), rút gọn text (ngày, buổi, món, LTTP, định lượng).
2. Kèm danh sách LTTP (+ tuỳ chọn danh mục món) của **đơn vị hiện tại** để LLM ưu tiên tên khớp.
3. Gọi LLM (provider cấu hình env: vd. `MENU_AI_PROVIDER`, `MENU_AI_API_KEY`, `MENU_AI_MODEL`).
4. Parse JSON theo schema; BE **fuzzy map** tên → `commodityId`; không map → `mapped: false`, `commodityId: null`.
5. Thiếu API key → lỗi cấu hình rõ ràng, không gọi LLM.
6. Timeout / JSON lỗi → retry parse tối đa 1 lần hoặc trả lỗi thân thiện; **không** ghi DB.

## An toàn & vận hành

- LLM không ghi DB trực tiếp — chỉ `ai-apply` sau confirm.
- Rate-limit endpoint suggest (tránh spam chi phí).
- Log requestId + unitId + date; không log full API key; cân nhắc không log raw prompt đầy đủ production nếu chứa PII đơn vị.

## Kiểm thử tối thiểu

- Unit: fuzzy map tên LTTP; reject commodity ngoài kho; parse schema giả.
- Unit/service với LLM mock: suggest → apply ghi đủ 3 buổi.
- Smoke UI: nút → preview → apply (manual / e2e sau).

## Lộ trình tiếp

- **C**: chat reuse cùng retrieval + tools (đọc menu ngày, đề xuất đổi món).
- **B**: suggest tuần = vòng A + ràng buộc tránh trùng / ngân sách.
- Fine-tune / embedding khi volume lịch sử đủ lớn.
