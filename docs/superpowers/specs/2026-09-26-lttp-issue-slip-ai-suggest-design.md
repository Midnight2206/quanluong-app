# AI gợi ý phiếu xuất LTTP (v1)

Ngày: 2026-09-26  
Liên quan: `2026-07-24-kitchen-menu-ai-suggest-design.md`, LTTP phiếu xuất (`LttpPhieuXuatTab`)  
Approach: **1** — mirror menu AI (suggest → preview → apply vào form)

## Vấn đề

User lập phiếu xuất kho LTTP thủ công (header + nhiều dòng hàng). Muốn mô tả bằng ngôn ngữ tự nhiên và để AI điền form — có kiểm soát trước khi lưu.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Flow | Preview → **Áp dụng** (không auto-POST phiếu) |
| Nội dung gợi ý | **Header + dòng hàng** |
| UX v1 | Dialog text một lần (giống menu AI); multi-turn chat / voice = phase sau |
| Áp dụng | **Ghi đè dòng hàng**; header chỉ điền field **trống / chưa user-touched** |
| Persist | Chỉ merge vào state form (+ draft IDB); user Lưu → `POST` / outbox như hiện tại |
| LLM | Reuse `MENU_AI_*` trên server |
| Apply API riêng | **Không** — không cần `ai-apply`; apply = FE |

## Ngoài phạm vi (v1)

- Multi-turn chat panel, voice input
- Gợi ý khi đang **sửa** phiếu đã lưu
- Sửa từng dòng trong dialog trước khi áp dụng
- Auto-create / auto-submit phiếu
- Qdrant / fine-tune
- Client-side LLM / lộ API key

---

## 1. Kiến trúc & API

```
[LttpPhieuXuatTab] — nút «AI gợi ý phiếu»
        │
        ▼
[Dialog] prompt text ──POST──► /lttp/issue-slips/ai-suggest
        │                              │
        │                              ▼
        │                    LLM JSON → map catalog → resolve giá/NCC
        │                              │
        ◄──── { headerDraft, lines[], warnings[], meta }
        │
        ▼ preview → Áp dụng → merge form state → user Lưu
```

### `POST /lttp/issue-slips/ai-suggest`

- **Auth / permission:** cùng quyền tạo phiếu xuất LTTP hiện có + `unitDataScopeMiddleware`.
- **Body:**

```js
{
  unitId: number,          // đơn vị phát hành (kho)
  prompt: string,          // mô tả NL (bắt buộc, trim, max length hợp lý vd. 2000)
  issueDate?: string,      // YYYY-MM-DD — gợi ý context / resolve giá
  receivedDate?: string,
  recipientUnitId?: number
}
```

- **Response:**

```js
{
  headerDraft: {
    issueDate: string | null,
    receivedDate: string | null,
    recipientUnitId: number | null,
    recipientDisplayName: string | null,
    buyerUserId: number | null,
    buyerDisplayName: string | null,
    slipNote: string | null
  },
  lines: Array<{
    commodityId: number | null,
    commodityName: string,
    code: string | null,
    quantity: number | null,
    priceKind: 'market' | 'tgsx' | null,
    lttpSupplierId: number | null,
    unitPrice: number | null,
    mapped: boolean,
    reason?: string
  }>,
  warnings: string[],
  meta: {
    historySampleCount?: number,
    model?: string
  }
}
```

- Thiếu `MENU_AI_API_KEY` → lỗi cấu hình rõ (không gọi LLM).
- Rate-limit endpoint (mirror menu AI).
- **Không ghi DB.**

---

## 2. UX & quy tắc Áp dụng

### Entry

- Nút **«AI gợi ý phiếu»** trên toolbar tab Phiếu xuất.
- Chỉ hiện khi **tạo mới** (không edit phiếu đã lưu).

### Dialog

1. Textarea mô tả (placeholder ví dụ ngắn).
2. Gửi → loading.
3. Preview: khối **Header** + bảng **Dòng hàng** (mapped / chưa map) + danh sách `warnings`.
4. **Áp dụng** | **Hủy**. Không chỉnh sửa chi tiết trong dialog.

### Áp dụng

| Phần | Hành vi |
|------|---------|
| Header | Chỉ ghi field **trống** hoặc **chưa user-touched**. Field mặc định (vd. `issueDate` = hôm nay) vẫn cho AI ghi nếu user chưa đụng control đó. |
| Dòng hàng | **Thay toàn bộ** rows bằng các dòng `mapped: true` có `commodityId`, `quantity > 0`, `priceKind` ∈ `{ market, tgsx }`, và có thể resolve supplier. |
| Unmapped | Bỏ qua; toast số dòng bỏ qua (vd. *«Đã áp dụng N dòng; bỏ qua M dòng chưa khớp LTTP»*). |
| Giá / NCC | Dùng giá trị BE đã resolve trong `lines[]`; FE không tự đoán. |

Sau Áp dụng: form + draft persist như tay điền; user kiểm tra rồi Lưu.

### Dirty / touched (header)

- Theo dõi `touched` (hoặc tương đương) cho: `issueDate`, `receivedDate`, `recipientUnitId`, `buyerUserId`, `slipNote`.
- AI chỉ ghi khi `!touched[field]` (và giá trị draft AI không null).

---

## 3. BE map, an toàn, kiểm thử

### Suggest pipeline

1. Context: catalog commodities (+ suppliers) của `unitId`; vài phiếu xuất gần đây (text rút gọn) làm few-shot.
2. Gọi LLM (`MENU_AI_PROVIDER` / `MENU_AI_API_KEY` / `MENU_AI_MODEL` / timeout) → JSON schema cố định.
3. Fuzzy map tên/mã → `commodityId`; gọi logic tương đương `GET /lttp/issue-slips/resolve` hoặc effective price → `unitPrice`, `lttpSupplierId` mặc định.
4. Enforce:
   - Tối đa 2 dòng / commodity (`market` | `tgsx`).
   - Không trùng `(commodityId, priceKind)`.
   - Thiếu supplier bắt buộc → `mapped: false` + warning.
5. Recipient / buyer: chỉ set khi khớp unit/user trong scope; không chắc → `null`.

### An toàn & vận hành

- API key chỉ trên server.
- Rate-limit suggest.
- Log `requestId` + `unitId`; không log API key; tránh log full prompt nếu chứa PII.
- LLM không ghi DB.

### Kiểm thử tối thiểu

- Unit: fuzzy map; resolve mock → line `mapped`; duplicate `priceKind` bị loại/warn.
- Service + LLM mock: suggest trả shape đúng.
- FE contract / smoke: nút → dialog → apply merge (header untouched vs touched; lines replace).

### Files dự kiến

| Layer | Path |
|-------|------|
| BE service | `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.js` (+ reuse LLM helper từ kitchen hoặc shared thin wrapper) |
| BE route/controller/validator | `lttp.routes.js` / controller / validator |
| FE API | `packages/shared/src/features/lttp/api/lttpApi.js` |
| FE dialog | `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.jsx` |
| FE wire | `LttpPhieuXuatTab.jsx` |

---

## 4. Phase sau (không làm v1)

- Panel chat multi-turn trên phiếu xuất.
- Voice → text.
- Gợi ý khi edit phiếu đã lưu.
- `ai-apply` server-side nếu cần audit/apply không qua form.
