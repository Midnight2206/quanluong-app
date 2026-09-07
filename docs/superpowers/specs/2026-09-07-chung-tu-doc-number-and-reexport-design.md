# Design Spec: Số chứng từ (quyển + số chạy) & Xuất lại tại chỗ

**Date:** 2026-09-07  
**Status:** Draft for review  
**Feature:** Quy tắc số/quyển cho BKMH · PNK · PXK; sổ cấp số ổn định; nút Xuất lại (đổi mẫu / chữ ký / tuỳ chọn đọc lại dữ liệu) ghi đè folder cũ, không tạo bản ghi hay folder mới  

---

## 1. Problem

- Monthly PXK (và một số path khác) thường để trống `soChungTu` vì chỉ đọc settings.
- BKMH đang dùng `mmyydd` — không thống nhất với nhu cầu số phiếu chạy trong quyển.
- Xuất lại / sửa sai hiện dễ tạo batch/folder mới → số chứng từ “nhảy”, trong khi lịch sử đã in cần giữ số cũ.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Format: `quyenSo` = `mmyy` theo kỳ xuất; `soChungTu` = số chạy trong quyển, pad 4 (`0001`…) |
| 2 | Bộ đếm theo `(unitId kho xuất, categoryKey, quyenSo)` — BKMH / PNK / PXK độc lập |
| 3 | Cả ba loại CT dùng số chạy trong quyển (BKMH **bỏ** `mmyydd` cho lần xuất **mới**) |
| 4 | Sổ cấp số DB: assignment theo `sheetKey`; không thu hồi số khi sheet mất |
| 5 | Sheet mới (khi refresh data): cấp `max(seq)+1`; sheet cũ giữ số đã cấp |
| 6 | Xuất lại: chọn lại mẫu; luôn đọc lại signature settings; checkbox đọc lại dữ liệu (default **tắt**); số + quyển **không đổi** |
| 7 | Xuất lại: **không** insert batch/monthly mới; **không** tạo folder mới; clear files trong folder cũ rồi render lại; update metadata tại chỗ |
| 8 | Cách triển khai: sổ số + API clear folder (không chỉ dựa `summaryJson`) |
| 9 | Ngoài scope: backfill số lịch sử cũ; sửa số tay; thu hồi số; version history từng lần re-export; đổi pad sau ship |

---

## 3. Numbering

### 3.1 Fields trên context PDF

| Field | Rule |
|-------|------|
| `quyenSo` | `mmyy` từ `periodMonth` / kỳ xuất (override settings profile chỉ nếu product sau này cho phép; mặc định derived) |
| `soChungTu` / `so` / `soPhieu` | chuỗi pad 4 từ sổ; không lấy settings trống hay `mmyydd` |

### 3.2 `sheetKey`

| Tình huống | `sheetKey` |
|------------|------------|
| Aggregation by-unit | `unit:{recipientUnitId}` |
| PXK by-day | `unit:{recipientUnitId}\|day:{YYYY-MM-DD}` |
| BKMH / PNK slice | bám identity ổn định hiện có (vd. buyerKey + periodDate + unit nếu có); encode thành một string deterministic |
| Xuất 1 phiếu LTTP | `slip:{issueSlipId}` |

Cùng `(unitId, categoryKey, quyenSo, sheetKey)` luôn map về cùng một `soChungTu`.

### 3.3 Cấp số

1. Lookup assignment; nếu có → dùng lại.
2. Nếu chưa: trong transaction, tăng `ChungTuDocNumberCounter.nextSeq`, insert assignment (`seq`, `soChungTu = pad4(seq)`).
3. Không xóa assignment khi sheet biến mất (lỗ số được phép).

---

## 4. Persistence (Node / Prisma)

### `ChungTuDocNumberCounter`

| Cột | Ý nghĩa |
|-----|---------|
| `unitId` | Đơn vị kho xuất |
| `categoryKey` | Loại CT |
| `quyenSo` | `mmyy` |
| `nextSeq` | Số sẽ cấp tiếp theo (int) |

Unique: `(unitId, categoryKey, quyenSo)`.

### `ChungTuDocNumberAssignment`

| Cột | Ý nghĩa |
|-----|---------|
| `unitId`, `categoryKey`, `quyenSo` | Scope đếm |
| `sheetKey` | Identity sheet |
| `seq` | Int |
| `soChungTu` | String pad 4 |
| `createdAt` | Audit |

Unique: `(unitId, categoryKey, quyenSo, sheetKey)`.

---

## 5. Xuất lần đầu

1. Resolve sheet contexts như hiện tại (aggregation / monthly / single slip).
2. Với mỗi sheet: gán `quyenSo` + `soChungTu` từ sổ (§3).
3. Tạo folder document-service + files; tạo `ChungTuPdfExportBatch` / `ChungTuBkmhMonthly` (+ exports/slices) như pipeline hiện có.
4. Lưu `soChungTu` / `quyenSo` vào `summaryJson` / slice columns để UI lịch sử hiển thị.

BKMH monthly: lần xuất đầu vẫn upsert theo `(storageUnitId, periodMonth)` nếu đã có row — nhưng **không** đổi số đã cấp cho `sheetKey` đã có; chỉ cấp mới cho sheet mới. Nếu product hiện đang xóa folder + tạo folder mới khi “xuất lại tháng”, chuyển sang flow §6.

---

## 6. Xuất lại

### 6.1 UI

- Nút **Xuất lại** trên lịch sử / tổng hợp cho **mọi** loại CT (batch PXK/PNK + BKMH monthly).
- Dialog:
  - Chọn mẫu PDF (published)
  - Checkbox **Đọc lại dữ liệu nguồn** (default off)
  - Hiển thị readonly `quyenSo` / danh sách số phiếu hiện có (optional, tối thiểu không cho sửa)
  - Luôn áp dụng signature settings mới nhất (+ extraFields)

### 6.2 API (hướng)

- `POST /…/pdf-export-batches/:id/re-export` body `{ pdfTemplateId, refreshData: boolean }`
- `POST /…/bkmh-monthly/:id/re-export` (hoặc path hiện có tương đương) cùng body

### 6.3 Pipeline

1. Load batch/monthly hiện có (`documentServiceFolderId` giữ nguyên).
2. Nếu `refreshData`: resolve lại nguồn; else: dựng lại contexts từ snapshot/detailRows đã lưu (vẫn materialize chữ ký + template mới).
3. Gán số: sheet cũ giữ assignment; sheet mới (chỉ khi refresh) cấp tiếp.
4. Document-service: **clear all files** trong `folderId` → `POST .../documents` từng file mới.
5. Prisma **update** rows: template ids, `documentServiceFileId`, `summaryJson` / slice meta, `sourceDataHash`, `signaturesJson`, `updatedAt`, `fileCount` / `sliceCount`.
6. Sheet mất: xóa (hoặc cascade) export/slice row tương ứng; **không** xóa assignment trên sổ.
7. Sheet mới: **insert** export/slice con trong cùng batch/monthly (đây là file con mới, không phải batch mới) — vẫn cùng folder.

---

## 7. Document-service

Thêm khả năng xóa toàn bộ file trong folder (giữ folder id), ví dụ:

`DELETE /v1/folders/{folder_id}/files`

Hoặc `POST /v1/folders/{folder_id}/replace-documents` (clear + add atomic) nếu muốn một round-trip.

Không đổi contract render document (fields/rows/signatures) ngoài việc Node gửi đúng `soChungTu` / `quyenSo`.

---

## 8. FE touchpoints

- History / Summary panels: nút Xuất lại + dialog.
- Export workspace lần đầu: không bắt user nhập số; số hiện sau khi xuất (hoặc preview nếu có).
- Cập nhật copy help: BKMH không còn mô tả `mmyydd` cho số chứng từ mới.

---

## 9. Testing (acceptance)

1. Xuất PXK by-unit tháng mới → `quyenSo=mmyy`, sheets `0001`, `0002`, …
2. Xuất lại không refresh → cùng số, cùng `folderId`, cùng batch id; chữ ký/mẫu mới nếu đổi.
3. Xuất lại có refresh, thêm đơn vị nhận → sheet cũ giữ số; sheet mới `000N+1`; folder id không đổi.
4. Xuất lại có refresh, mất một sheet → PDF đó biến mất khỏi folder; số cũ không tái sử dụng cho sheet khác trong cùng quyển.
5. BKMH xuất mới dùng số chạy, không `mmyydd`.
6. PNK / PXK counter độc lập trong cùng `unitId` + `quyenSo`.
7. Concurrent cấp số (hai request) không trùng `soChungTu` (transaction / unique).

---

## 10. Out of scope

- Backfill gán số cho PDF/batch đã xuất trước spec này.
- Cho user sửa tay `soChungTu` / `quyenSo`.
- Thu hồi / tái sử dụng số sheet đã mất.
- Lưu đầy đủ version mỗi lần re-export (chỉ overwrite).
- Đổi độ dài pad sau khi ship.
- Đổi layout document-service ngoài clear-files API.

---

## 11. Non-goals / risks

- Batch cũ trước ship có thể trống hoặc `mmyydd`: re-export lần đầu sau ship **giữ** số đã in trên snapshot nếu có; chỉ sheet chưa có assignment mới lấy số chạy (chi tiết implement: prefer snapshot `soChungTu` khi seed assignment lần đầu từ lịch sử — optional nhỏ trong plan; mặc định: không backfill hàng loạt).
- `refreshData=false` yêu cầu đủ snapshot (`detailRowsJson` / tương đương); nếu thiếu → 400 bảo phải bật đọc lại dữ liệu.
