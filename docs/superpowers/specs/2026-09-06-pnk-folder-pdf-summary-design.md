# Design Spec: PNK folder PDF summary (BKMH-like)

**Date:** 2026-09-06  
**Status:** Draft for review  
**Feature:** Tab Tổng hợp + panel theo từng folder PDF xuất PNK; lưu meta slice trên `ChungTuPdfExport`; Lịch sử PNK bỏ accordion file  

---

## 1. Problem

- Tab **Tổng hợp** CTQT chỉ bật cho BKMH (`hasSummary`).
- PNK xuất nhiều PDF vào **folder batch** (`ChungTuPdfExportBatch`) nhưng Lịch sử chỉ accordion file; không có bảng tổng hợp Số CT / Ngày / Tổng tiền + thao tác từng phiếu như BKMH.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | Cách 1: meta trên export batch hiện có — **không** dựng sổ tháng PNK mới |
| 2 | `hasSummary: true` cho `phieu-nhap-kho` (BKMH giữ nguyên) |
| 3 | Lưu meta lúc tạo batch từ `slice.context` → `summaryJson` trên `ChungTuPdfExport` |
| 4 | Meta: `soChungTu`, `periodDate` (và/hoặc `ngayThangNam`), `tongTien`, `recipientUnitName?` |
| 5 | Tab Tổng hợp PNK: list **folder batch** → **Mở tổng hợp** |
| 6 | Panel: bảng file trong folder (cột như BKMH) + Xem / Tải / In |
| 7 | Lịch sử PNK: In tất cả / Tải zip / Xem tổng hợp / Xóa — **không** accordion file |
| 8 | Folder cũ thiếu meta: cột «—»; vẫn xem/tải/in qua `documentServiceFileId` |
| 9 | Ngoài scope: PXK summary; BKMH monthly ledger clone; backfill meta folder cũ |

---

## 3. Data model

`ChungTuPdfExport.summaryJson Json?`:

```json
{
  "soChungTu": "…",
  "periodDate": "YYYY-MM-DD",
  "ngayThangNam": "…",
  "tongTien": 123456,
  "recipientUnitName": "…"
}
```

- `tongTien`: number (raw); FE `formatVnd`.
- `recipientUnitName`: chỉ meaningful khi `aggregationMode === "by-unit"` (cột ẩn nếu không).
- Extract helper (pure): `buildExportSummaryFromContext(context)` — đọc các key đã có trên context / derived fields dùng lúc render PNK; thiếu → omit / null.

`mapBatchExportRow` flatten summary vào response file object (cùng shape FE dùng cho bảng).

**Tổng tiền folder (list):** sum `tongTien` các file có số; nếu không file nào có meta → `null` / «—».

---

## 4. Backend

### 4.1 Create batch

Trong vòng `for (const slice of slices)` khi push `createdFiles`, gắn `summaryJson: buildExportSummaryFromContext(slice.context)`.

Persist trên `exports.create`.

### 4.2 API

Giữ:

- `GET /chungtuquyettoan/pdf-export-batches?unitId&categoryKey`
- Batch detail / zip / merged / file download (đã có)

Không bắt buộc endpoint mới nếu list đã `include: exports` với summary flatten.

---

## 5. Frontend

### 5.1 Config

`chungTuCategoryConfig`: `hasSummary: tab.id === "bang-ke-mua-hang" || tab.id === "phieu-nhap-kho"`.

### 5.2 `ChungTuSummaryWorkspace`

- `categoryKey === "bang-ke-mua-hang"` → UI BKMH hiện tại.
- `categoryKey === "phieu-nhap-kho"` → list batches (`useChungTuPdfExportBatchesQuery`):

| Cột | Nội dung |
|-----|----------|
| Folder | `displayName` |
| Kỳ | `periodMonth` / date range label |
| Số file | `fileCount` |
| Tổng tiền | sum meta |
| Cập nhật | `updatedAt` |
| Thao tác | Mở tổng hợp |

### 5.3 Panel

`ChungTuPnkBatchSummaryPanel` (tên có thể chỉnh):

| Cột | Khi |
|-----|-----|
| Số chứng từ | luôn (`summary.soChungTu` hoặc «—») |
| Ngày | `ngayThangNam` / `periodDate` |
| Tên đơn vị | `aggregationMode === "by-unit"` |
| Tổng tiền | luôn |
| Thao tác | Xem · Tải · In (API file batch hiện có) |

Header panel: In tất cả (merged) · Tải zip (cùng hành vi Lịch sử).

Mở từ tab Tổng hợp **hoặc** Lịch sử.

### 5.4 `ChungTuHistoryWorkspace`

Khi `categoryKey === "phieu-nhap-kho"`:

- Card/folder actions: In tất cả | Tải zip | **Xem tổng hợp** | Xóa  
- **Không** render accordion «File trong folder»  
- BKMH / PXK: không đổi trong spec này (PXK vẫn accordion nếu đang vậy)

---

## 6. Tests

1. `buildExportSummaryFromContext` — happy + missing fields.
2. Create-batch path (unit/service test hoặc source+helper): `summaryJson` set trên create payload.
3. `mapBatchExportRow` exposes summary fields.
4. Config: PNK `hasSummary === true`; PXK false.
5. FE source: SummaryWorkspace PNK branch; History PNK no accordion + «Xem tổng hợp».

---

## 7. Manual acceptance

1. Xuất PNK → Tổng hợp liệt kê folder mới; mở panel đủ cột.  
2. Lịch sử PNK: không accordion; bốn action.  
3. Folder cũ: «—» trên cột meta; file vẫn tải nếu còn.  
4. BKMH Tổng hợp / Lịch sử không regress.

---

## 8. Out of scope

- PXK tổng hợp  
- Backfill `summaryJson` cho batch cũ  
- Đổi document-service render  
- Persist selection (P5 backlog)  
