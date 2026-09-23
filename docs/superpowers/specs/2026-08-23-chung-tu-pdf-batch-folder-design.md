# Chứng từ quyết toán — PDF batch, folder trên document-service

Ngày: 2026-08-23  
Mở rộng: `2026-08-23-chung-tu-document-service-pdf-design.md` (MVP PDF đơn file)  
Branch dự kiến: `feat/document-service-p4` (hoặc nhánh con)

## Mục tiêu

Sửa luồng dữ liệu PDF (tên mặt hàng và cột bảng), xuất **nhiều PDF theo chế độ gộp** (theo ngày / theo đơn vị), cung cấp **catalog Named Range** cho người làm mẫu, tab **Cài đặt chữ ký**, và **lịch sử dạng folder** trên document-service (tải zip / in gộp).

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Lưu trữ | **Document-service sở hữu folder + PDF** (không MEDIA_ROOT cho export mới) |
| Theo ngày | Mỗi ngày có dữ liệu → **1 PDF**; tổng hợp các đơn vị đã chọn |
| Theo đơn vị | Mỗi đơn vị có dữ liệu → **1 PDF**; tổng hợp mọi ngày trong tháng |
| Ngày/đơn vị trống | **Bỏ qua** — không tạo PDF |
| Full (`aggregationMode=full`) | **1 PDF** từ `rootContext` (cả tháng, mọi đơn vị đã chọn) |
| Tab chữ ký | Tab con **Cài đặt chữ ký** trong từng loại chứng từ (theo `categoryKey`) |
| Tải folder | File **`.zip`** |
| In folder | **Gộp PDF** → mở tab → dialog in trình duyệt |
| Resolver / permission | Giữ `resolveChungTuContext`, unit scope, permission hiện tại |

## Phát hiện bug — tên mặt hàng trống

Document-service derive **column key** từ tiêu đề `TABLE_HEADER` (slug), ví dụ `"Tên mặt hàng"` → `ten_mat_hang`.  
Mapper hiện tại ghi `ten_hang` (từ `tenHang` camelToSnake) → **key không khớp** → ô trống.

**Fix:** mapper resolve **template column key → catalog fieldKey → giá trị**, output dùng **key thực trên template** (không ép template theo camelToSnake).

## Kiến trúc tổng thể

```
FE Xuất
  → POST /chungtuquyettoan/pdf-export-batches
       resolveChungTuContext (giữ)
       POST document-service /v1/folders (tạo folder)
       theo aggregationMode:
         by-day:   foreach sheetContext (detailRows.length > 0)
         by-unit:  foreach sheetContext (detailRows.length > 0)
         full:     rootContext (detailRows.length > 0)
           map context slice → payload
           POST /v1/folders/{folderId}/documents (render + lưu PDF)
       ghi ChungTuPdfExportBatch + ChungTuPdfExport[] (metadata Node)
  ← { batchKey, folderId, fileCount, files[] }

FE Lịch sử
  → GET /pdf-export-batches (tree folder)
  → GET .../zip | .../merged.pdf (proxy document-service)
  → DELETE batch → xóa folder document-service + rows Prisma

FE Cài đặt chữ ký
  → GET/PUT /chungtuquyettoan/signature-settings?categoryKey=
       lưu signature_block JSON theo categoryKey
       xuất PDF: merge settings + tên ký từ wizard
```

Node **mỏng**: orchestration, auth, metadata, proxy stream. Blob PDF **chỉ** trên document-service.

## Document-service — folder API

### Schema (Postgres)

**`folders`**

| Cột | Ý nghĩa |
|-----|---------|
| `id` | PK |
| `name` | Tên hiển thị (slug-safe) |
| `created_at` | |

**`folder_files`**

| Cột | Ý nghĩa |
|-----|---------|
| `id` | PK |
| `folder_id` | FK → folders |
| `file_name` | Tên file trong folder (vd. `2026-06-03.pdf`) |
| `pdf_path` | Đường dẫn tương đối trên disk service |
| `sort_key` | Thứ tự (ngày hoặc tên đơn vị) |
| `created_at` | |

Lưu file dưới `DOCUMENT_STORAGE_ROOT/folders/{folder_id}/{file_name}`.

### Endpoints

| Method | Path | Việc |
|--------|------|------|
| POST | `/v1/folders` | `{ name }` → `{ id, name, created_at }` |
| GET | `/v1/folders/{id}` | Metadata + `files[]` |
| POST | `/v1/folders/{id}/documents` | `{ template_id, fields, rows, signatures, signature_dates, signature_block?, file_name, sort_key? }` → render PDF, lưu vào folder, trả `{ file_id, file_name }` |
| GET | `/v1/folders/{id}/files/{file_id}` | Stream PDF đơn |
| GET | `/v1/folders/{id}/zip` | Stream `application/zip` |
| GET | `/v1/folders/{id}/merged.pdf` | Gộp PDF (`pypdf`) theo `sort_key` |
| DELETE | `/v1/folders/{id}` | Xóa folder + files disk + rows |

Auth: `X-Service-Key` (giữ pattern hiện tại).

## Node — schema Prisma

### `ChungTuPdfExportBatch` (mới)

| Cột | Ý nghĩa |
|-----|---------|
| `id` | PK |
| `batchKey` | Unique public id (`ctpdf_batch_…`) |
| `categoryKey` | |
| `unitId` | Scope đơn vị lưu trữ |
| `periodMonth` / `periodDate` / `issueSlipId` | Nullable |
| `unitIdsJson` | |
| `aggregationMode` | |
| `pdfTemplateId` | |
| `documentServiceTemplateId` | Snapshot |
| `documentServiceFolderId` | ID folder document-service |
| `displayName` | Tên folder hiển thị lịch sử |
| `fileCount` | |
| `sourceDataHash` | |
| `signaturesJson` | Snapshot |
| `createdById` | |
| timestamps | |

Index: `(categoryKey, unitId, createdAt)`.

### `ChungTuPdfExport` (sửa)

Thêm:

| Cột | Ý nghĩa |
|-----|---------|
| `batchId` | FK → `ChungTuPdfExportBatch` |
| `documentServiceFileId` | ID file trong folder |
| `sortKey` | Thứ tự trong folder |

**Deprecate cho export mới:** `storagePath` (nullable); export cũ vẫn download qua path cũ nếu có.

### `ChungTuSignatureSettings` (mới)

| Cột | Ý nghĩa |
|-----|---------|
| `id` | PK |
| `categoryKey` | Unique |
| `signatureBlockJson` | Config khối chữ ký (document-service shape) |
| `updatedById` | |
| timestamps | |

## Node — API

Cùng permission với PDF hiện tại (`LTTP_ISSUE_SLIPS_READ` / `WRITE`).

| Method | Path | Việc |
|--------|------|------|
| POST | `/pdf-export-batches` | Batch export (thay luồng chính) |
| GET | `/pdf-export-batches?categoryKey=&unitId=` | Lịch sử folder |
| GET | `/pdf-export-batches/:batchKey` | Chi tiết + files |
| GET | `/pdf-export-batches/:batchKey/zip` | Proxy zip |
| GET | `/pdf-export-batches/:batchKey/merged.pdf` | Proxy merged PDF |
| GET | `/pdf-export-batches/:batchKey/files/:fileId` | Proxy 1 PDF |
| DELETE | `/pdf-export-batches/:batchKey` | Xóa batch + folder DS |
| GET | `/signature-settings?categoryKey=` | Đọc config chữ ký |
| PUT | `/signature-settings` | Lưu config theo categoryKey |
| GET | `/pdf-template-field-catalog` | Catalog Named Range + gợi ý tiêu đc cột (static JSON) |

Giữ `POST /pdf-exports` tạm thời (legacy 1 file MEDIA_ROOT) hoặc redirect nội bộ sang batch 1 file — **khuyến nghị deprecate FE**, BE giữ 1 release.

## Mapper — column alias

File mới `chung-tu-pdf-column-alias.util.js`:

- `resolveColumnFieldKey(templateColumnKey)` — map slug template → catalog `fieldKey`
- Dùng `guessDetailFieldKeyFromLabel` + alias tĩnh: `ten_mat_hang` → `tenHang`, `ten_hang` → `tenHang`, …
- `mapDetailRowsForTemplate(detailRows, templateColumnKeys)` — output object keyed by **template keys**

Scalar fields: giữ `pickMappedFields`; bổ sung alias cho `FIELD_*` legacy (`tong_tien_bang_chu`, `ngay_thang_nam`, …).

## Logic batch theo aggregation

Sau `resolveChungTuContext`:

| Mode | Nguồn slice | Tên file gợi ý | `ngayThangNam` |
|------|-------------|----------------|----------------|
| `by-day` | `sheetContexts[]` có `detailRows.length > 0` | `{periodDate}.pdf` hoặc `{sheetName}.pdf` | Ngày của slice |
| `by-unit` | `sheetContexts[]` có dữ liệu | `{recipientUnitName}.pdf` (sanitize) | Ngày cuối tháng kỳ |
| `full` | `rootContext` nếu có dữ liệu | `{categoryKey}-{periodMonth}.pdf` | Ngày cuối tháng |

Mỗi slice: `buildDocumentServicePayload(sliceContext, …)` + `tongTienBangChu` từ `vndToVietnameseDocumentLine(totalAmount)` (đã có trong `buildContextBase`).

Chữ ký: `signature_block` từ `ChungTuSignatureSettings` + override wizard; `signatures` / `signature_dates` từ FE.

## Catalog Named Range (cho người làm mẫu)

### Scalar — đặt Named Range `FIELD_<snake_case>`

| Named Range | Nguồn |
|-------------|-------|
| `FIELD_ngay_thang_nam` | `Ngày DD tháng MM năm YYYY` |
| `FIELD_ngay` / `FIELD_thang` / `FIELD_nam` | Tách |
| `FIELD_tong_tien_bang_chu` | Số tiền bằng chữ |
| `FIELD_tong_tien` | Tổng tiền (format VND) |
| `FIELD_don_vi` | Tên đơn vị |
| `FIELD_don_vi_cap_tren` | Settings |
| `FIELD_quyen_so` / `FIELD_so_chung_tu` | Số chứng từ |
| `FIELD_bo_phan` / `FIELD_ghi_chu` | Settings |

### Bảng — `TABLE_HEADER` + `TABLE_DATA_ROW`

Tiêu đề cột nên khớp catalog (mapper alias). Gợi ý:

| Tiêu đề cột | fieldKey |
|-------------|----------|
| STT | stt |
| Tên hàng / Tên mặt hàng | tenHang |
| ĐVT | dvt |
| Số lượng | soLuong |
| Đơn giá | donGia |
| Thành tiền | thanhTien |
| Người bán | nguoiBan |
| Ghi chú | ghiChu |

Expose qua `GET /pdf-template-field-catalog` + panel help trên màn Xuất.

## FE

| Màn | Thay đổi |
|-----|----------|
| `ChungTuCategoryWorkspace` | Tab con thứ 3: **Cài đặt chữ ký** |
| `ChungTuSignatureSettingsWorkspace` | Form `signature_block` (số cột, labels, spacing) |
| `ChungTuExportWorkspace` | Gọi batch API; hiển thị số file tạo; link catalog |
| `ChungTuHistoryWorkspace` | Tree folder → expand files; Tải zip / In tất cả / Xóa |
| `chungTuPdfApi.js` | Batch + signature settings + catalog endpoints |

## Kiểm thử tối thiểu

- Unit: column alias (`ten_mat_hang` → giá trị `tenHang`); batch slice selection by-day/by-unit skip empty.
- document-service: folder CRUD, zip, merge (pytest).
- BE integration: mock document-service client — batch tạo N files metadata.
- FE smoke: xuất by-day tháng có 2 ngày → folder 2 PDF; zip + merged download.

## Ngoài phạm vi

- Xóa hoàn toàn `ChungTuPdfExport` legacy / MEDIA_ROOT migration hàng loạt.
- Named Range riêng cho từng cột (`COLUMN_*`) trên document-service.
- In trực tiếp máy in (chỉ browser print).
- Tab PLANNED.

## Rủi ro

- Tháng 31 ngày × nhiều đơn vị → folder lớn; cần timeout export hợp lý (Node có thể trả 202 + poll sau nếu chậm — **ngoài MVP**, MVP sync với timeout tăng).
- Tên file đơn vị trùng sau sanitize → thêm suffix `-2`.
- Export cũ MEDIA_ROOT và batch mới song song trong lịch sử — FE hiển thị cả hai hoặc filter `batchId != null` only (khuyến nghị: lịch sử chỉ batch mới, legacy giữ endpoint cũ).
