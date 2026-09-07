# BKMH — sổ tháng, tổng hợp slice, in/tải trong bảng

Ngày: 2026-08-30  
Liên quan: `2026-08-23-chung-tu-pdf-batch-folder-design.md`, `2026-08-27-chung-tu-aggregate-by-price-design.md`, `2026-08-27-node-py-document-pdf-data-contract-design.md`  
Branch dự kiến: `feat/document-service-p4` (hoặc nhánh con)

## Vấn đề

Luồng BKMH PDF hiện tại:

- Mỗi lần xuất tạo `ChungTuPdfExportBatch` mới (`batchKey` ngẫu nhiên) → nhiều folder cùng tháng/kho.
- Tab **Lịch sử** liệt kê từng file PDF trong accordion → «xổ file» khó quản lý.
- Không có bản ghi Node **duy nhất** theo kho LTTP + tháng.
- `ChungTuBkmhSnapshot` chỉ gắn Google Sheet sync, không phục vụ PDF export.

## Mục tiêu

1. Sau khi xuất BKMH thành công: **một bản ghi DB** / **đơn vị kho LTTP** / **tháng** (`YYYY-MM`).
2. Xuất lại cùng kỳ → **ghi đè** (upsert) bản ghi + folder PDF.
3. Tab **Tổng hợp** + nút **Xem tổng hợp** trong folder: bảng slice với Số CT, ngày, tên đơn vị (nếu có), tổng tiền; thao tác xem/tải/in **từng slice** trong bảng.
4. Folder (Lịch sử): **In tất cả**, **Tải zip**, **Xem tổng hợp** — **không** liệt kê file PDF lẻ ngoài accordion.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Phạm vi loại CT | **Chỉ BKMH** (`bang-ke-mua-hang`); PXK/PNK giữ batch cũ |
| Khóa duy nhất | `storageUnitId` (kho LTTP đang chọn khi xuất) + `periodMonth` |
| Xuất lại | **Upsert** — thay folder + slice rows; xóa file cũ trên document-service |
| Chế độ gộp | Giữ **by-day / by-unit / full**; mỗi slice = 1 dòng tổng hợp + 1 PDF |
| Blob PDF | Vẫn trên document-service (folder); Node giữ metadata |
| Tab mới | **Tổng hợp** (BKMH only) |
| Lịch sử BKMH | 1 dòng / tháng / kho; không list file con trong accordion |
| Folder actions | In tất cả, Tải zip, Xem tổng hợp |
| Slice actions | Xem, Tải, In — **chỉ** trong bảng tổng hợp |
| Google Sheet / Snapshot cũ | **Không đổi** trong phạm vi này |

## Mô hình dữ liệu (Prisma)

### `ChungTuBkmhMonthly`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | Int PK | |
| `storageUnitId` | Int FK → Unit | Kho LTTP |
| `periodMonth` | String(7) | `YYYY-MM` |
| `aggregationMode` | String(32) | `by-day` \| `by-unit` \| `full` |
| `unitIdsJson` | Json | Đơn vị dữ liệu đã chọn khi xuất |
| `pdfTemplateId` | Int | |
| `documentServiceTemplateId` | Int | |
| `documentServiceFolderId` | Int | Folder trên document-service |
| `displayName` | String | VD: `BKMH 06/2026 — Kho A` |
| `tongTienThang` | Decimal(18,2)? | Rollup tổng các slice |
| `sliceCount` | Int | |
| `sourceDataHash` | String(64)? | Hash LTTP tháng (staleness sau này) |
| `signaturesJson` | Json? | Snapshot chữ ký lúc xuất |
| `createdById` | Int | User xuất lần đầu |
| `updatedById` | Int | User xuất lần cuối |
| `createdAt` / `updatedAt` | DateTime | |

**Ràng buộc:** `@@unique([storageUnitId, periodMonth])`

### `ChungTuBkmhSlice`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | Int PK | |
| `monthlyId` | Int FK → ChungTuBkmhMonthly | onDelete Cascade |
| `sortKey` | String(128) | Thứ tự ổn định (ngày hoặc unitId) |
| `soChungTu` | String(64)? | Số chứng từ slice (đã format `Số: …` nếu template dùng prefix) |
| `periodDate` | Date? | Ngày slice (by-day); null nếu full tháng |
| `recipientUnitId` | Int? | Đơn vị nhận (by-unit) |
| `recipientUnitName` | String(255)? | Hiển thị tab tổng hợp |
| `ngayThangNam` | String(128)? | Chuỗi ngày tháng năm trên PDF (nếu có) |
| `tongTien` | Decimal(18,2)? | Tổng thành tiền slice |
| `documentServiceFileId` | Int | File PDF trên document-service |
| `fileName` | String(255) | Tên file trong folder |
| `createdAt` / `updatedAt` | DateTime | |

**Ràng buộc:** `@@unique([monthlyId, sortKey])`

**Quan hệ:** `ChungTuBkmhMonthly` 1—N `ChungTuBkmhSlice`.

## Luồng xuất PDF (BKMH)

```
POST /chungtuquyettoan/bkmh-monthly-exports  (hoặc tên tương đương)
  validate categoryKey = bang-ke-mua-hang
  resolveChungTuContext → rootContext + sheetContexts
  pickExportSlices (by-day | by-unit | full)
  find ChungTuBkmhMonthly(storageUnitId, periodMonth)
  if exists:
    delete folder files on document-service (reuse folder id or recreate)
    delete ChungTuBkmhSlice rows
  else:
    createDocumentFolder(displayName)
  foreach slice:
    buildDocumentServicePayload(slice context)
    renderToDocumentFolder → documentServiceFileId
    insert ChungTuBkmhSlice(metadata từ context)
  upsert ChungTuBkmhMonthly(rollup tongTienThang, sliceCount, …)
  return { monthlyId, sliceCount, folderId, slices[] summary }
```

**Nguồn metadata slice** (Node resolver, không Python):

| Cột tổng hợp | Nguồn context |
|--------------|---------------|
| `soChungTu` | `context.soChungTu` / `so` |
| `periodDate` | `context.periodDate` hoặc ngày slice |
| `recipientUnitName` | `context.recipientUnitName` (by-unit); ẩn cột nếu by-day/full |
| `ngayThangNam` | `context.ngayThangNam` |
| `tongTien` | `context.tongTien` / `tongTienSo` parsed |

## API (Node)

| Method | Path | Mục đích |
|--------|------|----------|
| POST | `/bkmh-monthly-exports` | Xuất / upsert tháng |
| GET | `/bkmh-monthly` | List theo `storageUnitId`, filter `periodMonth?` |
| GET | `/bkmh-monthly/:id` | Chi tiết tháng + slices (tổng hợp) |
| GET | `/bkmh-monthly/:id/zip` | Proxy zip folder |
| GET | `/bkmh-monthly/:id/merged.pdf` | Proxy merged PDF (in tất cả) |
| GET | `/bkmh-monthly/:id/slices/:sliceId/file` | Proxy PDF một slice |
| DELETE | `/bkmh-monthly/:id` | Xóa tháng + folder document-service |

Permission: reuse `lttp.issue-slips.read` / `.write` như PDF batch hiện tại.

**BKMH export wizard:** gọi endpoint mới thay vì `pdf-export-batches` khi `categoryKey === bang-ke-mua-hang`.

## UI (FE)

### Tab con BKMH (thứ tự)

1. **Xuất chứng từ** — giữ wizard; submit → API mới  
2. **Tổng hợp** — bảng các `ChungTuBkmhMonthly` của kho đang chọn  

Cột tab Tổng hợp (cấp tháng):

| Cột | Nội dung |
|-----|----------|
| Tháng | `periodMonth` → label `MM/YYYY` |
| Chế độ gộp | by-day / by-unit / full |
| Số slice | `sliceCount` |
| Tổng tiền tháng | `tongTienThang` |
| Cập nhật lúc | `updatedAt` |
| Thao tác | Mở tổng hợp slice |

3. **Lịch sử** — 1 card / tháng (không accordion file con)  
   - Nút: **In tất cả** | **Tải zip** | **Xem tổng hợp** | Xóa  
4. **Cài đặt chữ ký** — giữ nguyên  

### Bảng tổng hợp slice (modal hoặc panel)

Mở từ tab Tổng hợp hoặc nút **Xem tổng hợp** ở Lịch sử.

| Cột | Hiển thị khi |
|-----|--------------|
| Số chứng từ | luôn |
| Ngày tháng năm | luôn |
| Tên đơn vị | `aggregationMode === by-unit` |
| Tổng tiền | luôn |
| Thao tác | **Xem** (tab PDF) · **Tải** · **In** |

**Không** hiển thị danh sách file PDF dưới folder accordion.

## Tương thích / migration

- `ChungTuPdfExportBatch` / `ChungTuPdfExport`: giữ cho PXK/PNK và **lịch sử BKMH cũ** (read-only hoặc ẩn sau BKMH chuyển sang monthly).
- Batch BKMH mới **không** tạo qua `pdf-export-batches`.
- Dữ liệu batch cũ: không backfill bắt buộc; có thể ẩn trong Lịch sử BKMH sau cutover.

## Ngoài phạm vi

- PXK/PNK monthly ledger
- Đồng bộ Google Sheet → monthly model
- Thay đổi document-service render/gộp dòng
- Staleness tự động re-export (chỉ lưu `sourceDataHash` để mở rộng sau)

## Tiêu chí xong

1. Xuất BKMH tháng 06/2026 lần 1 → 1 row `ChungTuBkmhMonthly` + N slice.
2. Xuất lại cùng kho + tháng → cùng 1 row monthly, slice thay thế, folder không nhân đôi.
3. Tab **Tổng hợp** liệt kê đúng rollup.
4. Lịch sử: In tất cả / Zip / Xem tổng hợp hoạt động; **không** list file lẻ trong accordion.
5. Bảng slice: xem/tải/in từng chứng từ.
6. PXK/PNK export batch không bị ảnh hưởng.
