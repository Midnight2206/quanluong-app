# Chứng từ quyết toán — xuất PDF qua document-service

Ngày: 2026-08-23  
Liên quan: `2026-08-17-document-service-p{1–4}-design.md` (render PDF từ template Named Ranges)  
Thay thế UX: Google Sheets sync trên 3 tab AVAILABLE của Chứng từ quyết toán.

## Mục tiêu

Trên **Bảng kê mua hàng**, **Phiếu xuất kho**, **Phiếu nhập kho**: user chọn tham số + mẫu `.xlsx` (document-service) + chữ ký → nhận **PDF**, lưu lịch sử tải lại/xóa. Không còn tạo/đồng bộ Google Sheet làm luồng chính.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Output | PDF qua document-service; thay Sheets trên UX chính |
| Phạm vi tab | 3 tab `AVAILABLE` |
| Mẫu | Upload/quản lý `.xlsx` (Named Ranges) trong app → `POST /v1/templates`; bỏ Drive picker trên FE xuất |
| Lịch sử | Prisma + file PDF dưới `MEDIA_ROOT`; mở/tải/xóa |
| Chữ ký | Form động theo slot mẫu (`signatures`, `signature_dates`, optional `signature_block`) |
| Kiến trúc | Adapter mỏng: giữ `resolveChungTuContext`; thay `syncSpreadsheetFromContext` bằng render + lưu |
| Đa sheet tháng (Sheets cũ) | MVP = **một PDF / một lần xuất** từ `detailRows` đã resolve |
| Code Drive/Sheets | Giữ trong repo nhưng FE không gọi; gỡ sạch = phase sau |
| MinIO / tab PLANNED / re-sync hash | Ngoài MVP |

## Kiến trúc

```
FE Xuất
  → POST /chungtuquyettoan/pdf-exports
       resolveChungTuContext (giữ)
       map context → { fields, rows, signatures, signature_dates [, signature_block] }
       documentService.renderDocumentPdf(templateId, payload)
       ghi file MEDIA_ROOT/chung-tu-pdf/... + ChungTuPdfExport
  ← { exportKey, fileName, downloadPath }

FE Mẫu
  → list/upload/delete ChungTuPdfTemplate
       upload proxy → document-service POST /v1/templates
       lưu categoryKey ↔ documentServiceTemplateId

FE Lịch sử
  → list / file stream / delete ChungTuPdfExport
```

**Giữ nguyên:** permission chứng từ / LTTP, unit scope, `POST /context-preview`, aggregation modes, data resolver.

**Không gọi từ FE mới:** Drive tree, seed Drive, fill-mapping Drive, `POST /documents`, `POST .../sync`.

## Schema Prisma

### `ChungTuPdfTemplate`

| Cột | Ý nghĩa |
|-----|---------|
| `id` | PK |
| `categoryKey` | `bang-ke-mua-hang` \| `phieu-xuat-kho` \| `phieu-nhap-kho` |
| `displayName` | Tên hiển thị |
| `documentServiceTemplateId` | ID bên document-service |
| `name`, `version` | Echo identity upload |
| `isActive` | Soft-disable |
| `uploadedById` | User upload |
| timestamps | |

Unique: `(categoryKey, documentServiceTemplateId)`.

### `ChungTuPdfExport`

| Cột | Ý nghĩa |
|-----|---------|
| `id` | PK |
| `exportKey` | Unique public id |
| `categoryKey` | |
| `unitId` | Đơn vị lưu trữ / scope chính |
| `periodMonth` / `periodDate` / `issueSlipId` | Nullable theo loại xuất |
| `unitIdsJson` | Danh sách đơn vị dữ liệu |
| `aggregationMode` | |
| `pdfTemplateId` | FK logic tới `ChungTuPdfTemplate.id` (int, không cascade bắt buộc) |
| `documentServiceTemplateId` | Snapshot |
| `fileName` | |
| `storagePath` | Relative dưới `MEDIA_ROOT` |
| `sourceDataHash` | Từ resolver |
| `signaturesJson` | Snapshot chữ ký đã gửi |
| `createdById` | |
| timestamps | |

Index: `(categoryKey, unitId, createdAt)`.

## API Node (`/chungtuquyettoan`)

Cùng auth/permission với module chứng từ hiện tại (không dùng `document-dev` / superadmin-only). Upload mẫu / xuất PDF: cùng quyền ghi đang dùng cho tạo chứng từ (vd. `LTTP_ISSUE_SLIPS_WRITE` / permission chứng từ hiện có trên route).

| Method | Path | Việc |
|--------|------|------|
| GET | `/pdf-templates?categoryKey=` | List mẫu active |
| POST | `/pdf-templates` | multipart `.xlsx` + `categoryKey` + `displayName` + `name` + `version` → document-service + row Prisma |
| DELETE | `/pdf-templates/:id` | `isActive=false` (MVP); tùy chọn không xóa blob document-service |
| GET | `/pdf-templates/:id/fields` | Proxy `GET /v1/templates/{dsId}/fields` (+ signature meta nếu có) |
| POST | `/pdf-exports` | Resolve → map → render → lưu → trả metadata |
| GET | `/pdf-exports?categoryKey=&…` | Lịch sử theo unit scope |
| GET | `/pdf-exports/:exportKey/file` | Stream `application/pdf` (auth) |
| DELETE | `/pdf-exports/:exportKey` | Xóa row + file disk |

Giữ `POST /context-preview`.

### Body `POST /pdf-exports` (logic)

- Tham số giống create document hiện tại: `categoryKey`, kỳ, `unitId` / `unitIds`, `aggregationMode`, …  
- `pdfTemplateId` (Prisma)  
- `signatures`: `{ [slotKey]: string }`  
- `signatureDates`: `{ [slotKey]: string }`  
- `signatureBlock` optional (override; mặc định lấy từ template document-service nếu đã lưu)

## Mapper `context` → document-service

1. Lấy schema field/column keys từ document-service (snake_case Named Ranges).  
2. **Fields:** scalar context (camelCase / registry hiện có) → khớp exact rồi `camelToSnake`; bỏ key không có trên mẫu.  
3. **Rows:** từng `detailRows[]` → object theo column keys mẫu (cùng quy tắc tên); format số/tiền giữ output resolver.  
4. **Signatures:** forward từ FE.  
5. Thiếu field/cột trên mẫu → ô trống (hành vi document-service hiện tại); không fail trừ khi render/upstream lỗi.

## FE

| Màn | Thay đổi |
|-----|----------|
| `ChungTuExportWorkspace` (+ wizard) | Picker `pdf-templates` + upload; form chữ ký; CTA Xuất PDF |
| `ChungTuHistoryWorkspace` | List/tải/xóa PDF exports; bỏ mở Sheet / đồng bộ |
| `chungTuQuyetToanTabsMeta` | Subtitle Sheets → PDF |
| API client | `chungTuPdfApi.js` (hoặc mở rộng `chungTuDocumentApi`) |

## Lưu file

- Root: `env.mediaRoot` (`MEDIA_ROOT`, Docker `/data/media`).  
- Path gợi ý: `chung-tu-pdf/{categoryKey}/{yyyy}/{exportKey}.pdf`.  
- Download chỉ qua API authenticated (không phụ thuộc public `/media` trừ khi đã có pattern sẵn và an toàn).

## Kiểm thử tối thiểu

- Mapper: camelCase → snake_case; bỏ key lạ; rows map đúng cột.  
- BE: upload template ghi Prisma + gọi document-service (mock client); export tạo file + row; download/delete.  
- FE smoke: 1 tab xuất PDF + hiện lịch sử (manual hoặc component test nhẹ nếu team có sẵn).

## Ngoài phạm vi

- Xóa module Drive/Sheets/fill-rules.  
- MinIO, nối sổ nhiều PDF, tab PLANNED.  
- Tái tạo multi-tab Sheet tháng thành nhiều PDF tự động.  
- “Đồng bộ lại” cùng `exportKey` (xuất lại = bản ghi mới).

## Rủi ro / lưu ý

- Mẫu `.xlsx` phải đúng convention Named Ranges (P3); mẫu Drive Sheets cũ **không** dùng trực tiếp.  
- `signature_block` phụ thuộc mẫu đã import có config; FE form theo `/fields`.  
- Dung lượng disk PDF lịch sử — chưa lifecycle/TTL trong MVP.
