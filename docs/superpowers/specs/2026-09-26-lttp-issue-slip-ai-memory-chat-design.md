# AI phiếu xuất LTTP — memory đơn vị + chat chỉnh (v1)

Ngày: 2026-09-26  
Bổ sung cho: `2026-09-26-lttp-issue-slip-ai-suggest-design.md`  
Approach: **1** — session chat + bảng `LttpIssueSlipAiMemory` theo `unitId`

## Vấn đề

Gợi ý một lần dễ lệch (alias tắt, nhân đôi `market`/`tgsx`). User muốn:

1. **Chat chỉnh** preview trong dialog sau lần gợi ý.
2. **Học theo đơn vị** — sửa sai / alias trở thành context cho lần suggest sau.
3. Ghi “bài học” khi **Áp dụng** và khi **Lưu phiếu** (không ghi sau mỗi turn chat).

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Phạm vi học | Theo **`unitId` kho** (không theo user) |
| Khi ghi memory | **Áp dụng** (commit preview) + **Lưu phiếu** (gắn `issueSlipId`) |
| Chat | Multi-turn trong cùng phiên dialog; mỗi reply cập nhật preview |
| Persist học | Bảng `LttpIssueSlipAiMemory` + inject vào prompt (không fine-tune / Qdrant) |
| `priceKind` v1 | Post-process cứng: mặc định chỉ `market`; giữ `tgsx` chỉ khi prompt/turns có tín hiệu TGSX rõ |
| Apply form | Giữ quy tắc v1 (header untouched; lines replace mapped) |
| `ai-apply` phiếu | **Không** — apply vẫn chỉ merge form FE |

## Ngoài phạm vi (v1)

- Vector DB / embedding
- Học theo user hoặc global cross-unit
- Ghi memory sau mỗi turn chat (không commit)
- Voice; gợi ý khi đang sửa phiếu đã lưu
- Sửa từng dòng bằng control trong dialog (chỉ chat + Áp dụng)

---

## 1. Bộ nhớ đơn vị + API phiên

### Model `LttpIssueSlipAiMemory`

| Field | Ý nghĩa |
|--------|---------|
| `unitId` | Phạm vi học (đơn vị kho phát hành) |
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
| `POST /lttp/issue-slips/ai-suggest` | Như v1 **+** tạo `sessionId`; inject ~10 memory đơn vị; response thêm `sessionId` |
| `POST /lttp/issue-slips/ai-chat` | Body `{ sessionId, unitId, message, currentPreview? }` → LLM chỉnh preview; append turns; trả preview mới + `sessionId` |
| `POST /lttp/issue-slips/ai-memory/commit` | Body `{ sessionId, finalPreview }` — gọi lúc **Áp dụng** (upsert memory: prompt/turns/`finalPreview`) |
| Hook Lưu phiếu | Nếu form mang `aiSessionId` (= `sessionId`): update memory `issueSlipId` |

**Suggest:** vẫn không ghi phiếu; có thể tạo row memory “session mở” (turns rỗng) hoặc chỉ cấp `sessionId` phía server/cache — implement chọn một: khuyến nghị **tạo row sớm** với `finalPreview=null` để chat append turns an toàn.

**Chat:** không commit `finalPreview`; chỉ cập nhật turns + trả preview đã enrich (map/resolve/post-process).

**Commit:** bắt buộc trước/khi Áp dụng; thiếu session → lỗi rõ. Hủy dialog → không commit (row session có thể GC/TTL sau; v1: để orphan `issueSlipId=null` hoặc xóa mềm — *ponytail:* orphan OK, dọn batch sau nếu cần).

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
2. Sau có preview: ô **chat** (“Đổi mat hang1 thành Gạo tẻ…”) → `ai-chat` → preview cập nhật; lịch sử turns ngắn trong dialog (scroll).
3. Có thể chat nhiều lượt (cap server, vd. 20 turn).
4. **Áp dụng** | **Hủy**. Không sửa grid dòng trong dialog.

### Áp dụng

1. `POST .../ai-memory/commit` với `finalPreview` = preview đang hiện.
2. Merge form qua `applyIssueSlipAiPreview` (quy tắc v1).
3. Giữ `aiSessionId` trên state form / draft IDB để Lưu gắn memory.
4. Toast unmapped như v1.

### Lưu phiếu

Sau `POST` / flush outbox tạo phiếu thành công: nếu có `aiSessionId`, gọi cập nhật memory `issueSlipId` (endpoint riêng mỏng hoặc gắn trong create response hook FE → `PATCH`/`POST` memory link). Thất bại link → log/toast nhẹ, **không** rollback phiếu.

### Hủy / đóng

Không commit; form không nhận preview. `aiSessionId` form không set.

---

## 3. Inject prompt + an toàn + kiểm thử

### Context khi suggest / chat (`unitId`)

1. Catalog commodities (+ suppliers) đơn vị — như v1.
2. **Memory đơn vị** — ~10 bản gần nhất, **ưu tiên** có `issueSlipId`; mỗi bản rút gọn: `prompt` + `finalPreview.lines` (mapped) + vài turn chat nếu còn budget token.
3. Phiếu xuất gần đây (few-shot v1).
4. System instruction: mặc định `market`; TGSX chỉ khi user nói rõ; tôn trọng alias đã thấy trong memory.

Chat prompt thêm: `currentPreview` + `message` + turns phiên hiện tại.

### An toàn & vận hành

- Rate-limit `ai-chat` / `ai-memory/commit` giống `ai-suggest` (mirror menu / issue AI).
- Max độ dài `message` / tổng `turns` (vd. 20 turn/session; truncate text cũ nếu vượt).
- API key chỉ server; không log key; tránh log full prompt PII nếu có thể.
- Scope: `unitId` phải nằm trong data scope user; `sessionId` phải thuộc `unitId` (+ optionally `createdById` cùng user — *ponytail:* check unit đủ cho v1).

### Self-check tối thiểu

- Commit tạo/cập nhật memory theo `sessionId`.
- Chat append turn + trả preview mới.
- Suggest/chat inject memory vào prompt builder (assert có đoạn memory khi DB có bản ghi).
- Không TGSX signal → drop dòng `tgsx`.
- Lưu phiếu gắn `issueSlipId` khi có `aiSessionId`.
- FE contract: dialog có chat sau preview; Apply gọi commit; form giữ `aiSessionId`.

### Files dự kiến

| Layer | Path |
|-------|------|
| Prisma | `LttpIssueSlipAiMemory` trong `schema.prisma` + migrate |
| BE memory/chat | `lttp-issue-slip-ai.service.js` (mở rộng) + prompt inject |
| BE post-process | helper trong enrich/service (TGSX gate) |
| BE routes | `ai-chat`, `ai-memory/commit` (+ optional link `issueSlipId`) |
| FE API | `lttpApi.js` mutations |
| FE dialog | `LttpIssueSlipAiSuggestDialog.jsx` (chat UI) |
| FE wire | `LttpPhieuXuatTab.jsx` — `aiSessionId` + commit/link |

---

## 4. Phase sau

- GC orphan memory / TTL
- Học theo user (opt-in) hoặc share memory nhánh cấp 1
- Qdrant / embedding retrieval
- Voice; edit-mode suggest

