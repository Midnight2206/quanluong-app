# AI phiếu xuất LTTP — memory đơn vị + chat chỉnh (v1)

Ngày: 2026-09-26  
Bổ sung cho: `2026-09-26-lttp-issue-slip-ai-suggest-design.md`  
Approach: **1** — session chat + bảng `LttpIssueSlipAiMemory` theo `unitId` kho + few-shot thói quen từ DB phiếu xuất theo **đơn vị nhận**

## Vấn đề

Gợi ý một lần dễ lệch (alias tắt, nhân đôi `market`/`tgsx`). User muốn:

1. **Chat chỉnh** preview trong dialog sau lần gợi ý.
2. **Học alias / sửa sai** theo kho — memory-chat thành context cho lần sau.
3. **Học thói quen đặt hàng** từ phiếu xuất production theo **đơn vị nhận (cấp 2)** — không fine-tune, đọc DB mỗi lần suggest.
4. Ghi memory khi **Áp dụng** + **Lưu phiếu** (không ghi sau mỗi turn chat).

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Memory-chat | Theo **`unitId` kho**; inject **~20** bản gần nhất (ưu tiên có `issueSlipId`) |
| Khi ghi memory | **Áp dụng** (commit preview) + **Lưu phiếu** (gắn `issueSlipId`) |
| Chat | Multi-turn trong cùng phiên dialog; mỗi reply cập nhật preview |
| Thói quen đơn vị nhận | Đọc `LttpIssueSlip` production theo `recipientUnitId` (few-shot / rút gọn); **không** train model |
| Persist học chat | Bảng `LttpIssueSlipAiMemory` (không fine-tune / Qdrant v1) |
| `priceKind` v1 | Post-process cứng: mặc định chỉ `market`; giữ `tgsx` chỉ khi prompt/turns có tín hiệu TGSX rõ |
| Apply form | Giữ quy tắc v1 (header untouched; lines replace mapped) |
| `ai-apply` phiếu | **Không** — apply vẫn chỉ merge form FE |

Hai nguồn học **bổ sung nhau**: memory = alias & sửa câu; phiếu DB = “đơn vị X thường lấy những gì / bao nhiêu”.

## Ngoài phạm vi (v1)

- Vector DB / embedding / fine-tune trên toàn bộ lịch sử
- Dump toàn bộ phiếu vào một prompt (chỉ N mẫu / top-K rút gọn)
- Học theo user hoặc share memory cross-nhánh không qua kho
- Ghi memory sau mỗi turn chat
- Voice; gợi ý khi đang sửa phiếu đã lưu
- Sửa từng dòng bằng control trong dialog (chỉ chat + Áp dụng)

---

## 1. Bộ nhớ đơn vị + API phiên

### Model `LttpIssueSlipAiMemory`

| Field | Ý nghĩa |
|--------|---------|
| `unitId` | Phạm vi học chat/alias (đơn vị kho phát hành) |
| `sessionId` | UUID phiên dialog (unique) |
| `prompt` | Mô tả gốc lúc suggest |
| `turns` | JSON `[{ role: 'user'\|'assistant', text, at }]` |
| `finalPreview` | JSON snapshot `{ headerDraft, lines, warnings? }` lúc Áp dụng |
| `issueSlipId` | `null` sau apply; set khi Lưu phiếu thành công |
| `createdById`, `createdAt`, `updatedAt` | audit |

Index: `(unitId, updatedAt desc)`, unique `sessionId`. FK `issueSlipId` → `LttpIssueSlip` `onDelete: SetNull`.

### API (cùng quyền tạo phiếu xuất + `unitDataScopeMiddleware`)

| Endpoint | Việc |
|----------|------|
| `POST /lttp/issue-slips/ai-suggest` | Như v1 **+** tạo `sessionId`; inject ~20 memory kho + few-shot thói quen đơn vị nhận; response thêm `sessionId` |
| `POST /lttp/issue-slips/ai-chat` | Body `{ sessionId, unitId, message, currentPreview? }` → LLM chỉnh preview; append turns; trả preview mới + `sessionId` |
| `POST /lttp/issue-slips/ai-memory/commit` | Body `{ sessionId, finalPreview }` — gọi lúc **Áp dụng** (upsert memory: prompt/turns/`finalPreview`) |
| Hook Lưu phiếu | Nếu form mang `aiSessionId` (= `sessionId`): update memory `issueSlipId` |

**Suggest:** vẫn không ghi phiếu; khuyến nghị **tạo row memory sớm** với `finalPreview=null` để chat append turns an toàn.

**Chat:** không commit `finalPreview`; chỉ cập nhật turns + trả preview đã enrich (map/resolve/post-process). Chat **không bắt buộc** re-inject full habit block mỗi turn nếu budget chật — tối thiểu giữ catalog + turns phiên + `currentPreview`; suggest thì full context.

**Commit:** bắt buộc trước/khi Áp dụng; thiếu session → lỗi rõ. Hủy dialog → không commit (*ponytail:* orphan `issueSlipId=null` OK; GC sau nếu cần).

### Post-process cứng (sau mọi LLM suggest/chat)

1. Detect tín hiệu TGSX trong `prompt` + `turns[].text` (keyword kiểu `tgsx`, `TG SX`, `tiêu chuẩn`, … — tập nhỏ cố định).
2. Nếu **không** có tín hiệu → drop mọi dòng `priceKind === 'tgsx'` (+ warning ngắn).
3. Tiếp tục fuzzy-map, resolve giá/NCC, scope header như v1.

---

## 2. UX dialog phiên + Áp dụng / Lưu

### Entry

Giữ nút **«AI gợi ý phiếu»** — chỉ mode **tạo mới** (như v1).

### Dialog thành phiên

1. Textarea mô tả gốc → **Gửi** → `ai-suggest` → hiện preview + `sessionId`.
2. Sau có preview: ô **chat** → `ai-chat` → preview cập nhật; lịch sử turns ngắn trong dialog.
3. Cap server ~20 turn/session.
4. **Áp dụng** | **Hủy**. Không sửa grid dòng trong dialog.

Truyền `recipientUnitId` từ form (nếu user đã chọn) vào suggest để ưu tiên thói quen đúng đơn vị nhận; nếu chưa chọn, AI có thể suy ra từ prompt rồi BE lọc few-shot sau khi header draft có `recipientUnitId` hợp lệ (*ponytail:* v1 đủ một lần — dùng `recipientUnitId` request nếu có; không vòng suggest thứ hai).

### Áp dụng

1. `POST .../ai-memory/commit` với `finalPreview` = preview đang hiện.
2. Merge form qua `applyIssueSlipAiPreview` (quy tắc v1).
3. Giữ `aiSessionId` trên state form / draft IDB.
4. Toast unmapped như v1.

### Lưu phiếu

Sau tạo phiếu thành công: nếu có `aiSessionId` → gắn `issueSlipId` vào memory. Fail link → toast/log nhẹ, không rollback phiếu.

### Hủy / đóng

Không commit; không set `aiSessionId` trên form.

---

## 3. Inject prompt + thói quen DB + an toàn

### Context khi suggest (`unitId` kho)

Thứ tự (rút gọn mỗi khối cho vừa budget):

1. Catalog commodities (+ suppliers) kho — như v1.
2. **Memory-chat kho** — **~20** bản gần nhất, **ưu tiên** có `issueSlipId`; mỗi bản: `prompt` + `finalPreview.lines` (mapped) + vài turn nếu còn chỗ.
3. **Thói quen đơn vị nhận** (production `LttpIssueSlip`):
   - Nếu có `recipientUnitId` (request hoặc đã scope-sanitize): lấy phiếu gần đây **cùng kho + cùng `recipientUnitId`** (vd. 15–20 phiếu), format few-shot (ngày + dòng tên/SL/`priceKind`).
   - Không có recipient: giữ few-shot phiếu kho gần đây như v1 (không bịa thói quen cấp 2).
   - *Tuỳ chọn cùng PR nếu gọn:* thêm 1 đoạn “top mặt hàng / SL điển hình” aggregate theo `recipientUnitId` (GROUP BY commodity, limit K) — không bắt buộc nếu few-shot phiếu đủ.
4. System: mặc định `market`; TGSX chỉ khi user nói rõ; tôn trọng alias memory; ưu tiên pattern của đơn vị nhận khi đã inject.

**Không** đọc toàn bộ lịch sử production vào một lần gọi LLM.

### Context khi chat

`currentPreview` + `message` + turns phiên; tái sử dụng catalog; memory/habit đầy đủ nếu còn budget, không thì cắt habit trước, giữ memory ngắn + turns.

### An toàn & vận hành

- Rate-limit `ai-chat` / `ai-memory/commit` giống `ai-suggest`.
- Max `message` / ~20 turn/session; truncate text cũ.
- API key chỉ server; không log key / full PII prompt nếu tránh được.
- Scope: `unitId` + `recipientUnitId` trong data scope; `sessionId` thuộc `unitId`.

### Self-check tối thiểu

- Commit memory theo `sessionId`; inject tới ~20 bản khi đủ data.
- Chat append turn + preview mới.
- Có `recipientUnitId` → history query lọc theo recipient (assert where clause / mock).
- Không TGSX signal → drop `tgsx`.
- Lưu phiếu gắn `issueSlipId`.
- FE: chat sau preview; Apply commit; form giữ `aiSessionId`.

### Files dự kiến

| Layer | Path |
|-------|------|
| Prisma | `LttpIssueSlipAiMemory` + migrate |
| BE | `lttp-issue-slip-ai.service.js` — memory load (~20), `loadHistorySamples` lọc recipient, prompt inject |
| BE | TGSX post-process helper |
| BE routes | `ai-chat`, `ai-memory/commit` (+ link `issueSlipId`) |
| FE | `lttpApi.js`, `LttpIssueSlipAiSuggestDialog.jsx`, `LttpPhieuXuatTab.jsx` |

---

## 4. Phase sau

- GC orphan memory / TTL; soft budget token đo thực tế rồi hạ N
- Aggregate habit table / materialized view nếu few-shot sống quá đắt
- Qdrant / embedding; fine-tune
- Học theo user; voice; edit-mode suggest
