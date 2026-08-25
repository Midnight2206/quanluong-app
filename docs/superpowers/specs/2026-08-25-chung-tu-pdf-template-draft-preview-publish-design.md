# Chứng từ PDF — Import (draft) → Preview → Publish

Ngày: 2026-08-25  
Liên quan: `2026-08-24-chung-tu-pdf-template-superadmin-design.md`, `2026-08-17-document-service-p4-design.md`, `2026-08-23-chung-tu-document-service-pdf-design.md`  
Branch: `feat/document-service-p4`

## Vấn đề

Validate cấu trúc Named Range (P3) không chứng minh **vị trí / layout** đúng ý đồ. Field lệch ô hoặc cột quá hẹp vẫn pass nhưng PDF sai. Admin hiện không xem trước bằng pipeline render thật trước khi mẫu được dùng tạo chứng từ.

## Mục tiêu

Thêm vòng đời mẫu: **draft → preview (PDF thật) → published**, và **retired** khi ngừng dùng. Chỉ mẫu `published` mới tạo chứng từ thật được. Preview dùng 100% `render_pdf()` hiện có + dữ liệu mẫu tự sinh (không lưu file).

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Phạm vi | Full stack: document-service + Node BE + Superadmin UI |
| Nguồn sự thật trạng thái | `status` trên document-service; Node mirror cùng enum |
| Enum | `draft` \| `published` \| `retired` |
| Bỏ dần | `ChungTuPdfTemplate.isActive` → thay bằng `status` |
| Upload mới | Luôn tạo `draft` (DS + Node) |
| Migration dữ liệu | Hybrid: Node `isActive=true` → `published` (cả DS + Node); `isActive=false` → `retired`; template DS không map Node: giữ backfill DS (`published`) |
| Preview | `GET` DS on-demand PDF; Superadmin mở blob **tab mới** |
| Ai được preview | Mọi `status` (kể cả `retired`) — soi lại lịch sử |
| Publish | Chỉ `draft` → `published`; gọi lại khi đã published/retired → **409** (không idempotent) |
| Retire | `draft` hoặc `published` → `retired`; đã `retired` → 409. Thay soft-deactivate |
| Unit picker | Chỉ `published` |
| `field_sources` / persist `signature_block` | **Ngoài phạm vi** vòng này; preview mặc định MANUAL + chữ ký dynamic |
| Skeleton Excel khung sẵn | Ngoài phạm vi |
| Un-publish về draft | Ngoài phạm vi |

## Kiến trúc

```
Admin (Superadmin :8081)
  Upload .xlsx
       → DS POST /v1/templates (status=draft)
       → Node ChungTuPdfTemplate status=draft
  Preview
       → Node GET proxy → DS GET /v1/templates/{id}/preview
       → PDF blob → window.open (tab mới)
  Publish
       → DS POST .../publish → Node status=published
  Retire (“Ngừng dùng”)
       → DS POST .../retire → Node status=retired

Unit app (:8080)
  GET pdf-templates → chỉ published
  Export → DS render chỉ khi published (409 nếu không)
```

DS là nguồn sự thật cho `status`. Node cập nhật sau khi DS thành công. Nếu DS OK mà Node fail: trả lỗi cho client, admin retry (không silent desync).

## Document-service

### Schema

```sql
ALTER TABLE templates
  ADD COLUMN status VARCHAR NOT NULL DEFAULT 'draft';
-- CHECK (status IN ('draft', 'published', 'retired'))
```

Alembic migration: cột `status`; backfill mọi row hiện có = `published` (an toàn tạm); Node migration sau đó sync theo `isActive`.

Model `Template.status`; response list/get kèm `status`.

### API

| Endpoint | Hành vi |
|----------|---------|
| `POST /v1/templates` | Import như P4; `status=draft` |
| `GET /v1/templates?status=` | Filter optional |
| `GET /v1/templates/{id}/preview` | `load_metadata_from_db` → `generate_placeholder_data` → `render_pdf` → `application/pdf`. Không persist. 404 nếu thiếu template |
| `POST /v1/templates/{id}/publish` | `draft` → `published`. Đã published/retired → 409 |
| `POST /v1/templates/{id}/retire` | `draft`\|`published` → `retired`. Đã retired → 409 |
| `POST /v1/templates/{id}/documents` (và path render nghiệp vụ tương đương, vd. folder docs) | Nếu `status != published` → **409** `TEMPLATE_NOT_PUBLISHED` |

Auth: giữ `X-Service-Key`.

### `generate_placeholder_data(metadata)`

| Loại | Giá trị mẫu |
|------|-------------|
| Field (mặc định MANUAL; chưa có field_sources) | `"{field_name} (mẫu)"` |
| Cột bảng | 20–30 dòng; ≥1 dòng text dài (test wrap/shrink + ≥2 trang nếu layout cho phép) |
| Chữ ký dynamic | `"(Tên người ký mẫu)"` |
| Chữ ký static | `static_name` nếu có trên default signature block |

Mục tiêu preview: lộ lệch vị trí, shrink quá mức, header trang 2, khối ký trang cuối — không thay validate cấu trúc P3.

## Node BE

### Prisma

`ChungTuPdfTemplate`: bỏ `isActive`; thêm `status String` (`draft|published|retired`), default `draft`. Index `(categoryKey, status)`.

Migration:

1. Thêm cột `status` (nullable tạm hoặc default).
2. Map: `isActive=true` → `published`; `false` → `retired`.
3. Gọi DS cập nhật `status` theo `documentServiceTemplateId` cho từng row (cùng mapping).
4. Drop `isActive`.

### Routes (superadmin cho ghi lifecycle)

| Route | Vai trò |
|-------|---------|
| `POST /pdf-templates` | Giữ; sau upload Node `status=draft` |
| `GET /pdf-templates` | Unit: chỉ `published`. SA: mọi status (hoặc `?status=`) |
| `GET /pdf-templates/:id/preview` | Proxy PDF từ DS (`GET /v1/templates/{id}/preview`) |
| `POST /pdf-templates/:id/publish` | DS publish rồi Node `published` |
| `POST /pdf-templates/:id/retire` | DS retire rồi Node `retired` (thay DELETE deactivate) |

`document-service.client.js`: `previewTemplatePdf`, `publishTemplate`, `retireTemplate`.

Export batch/single: chỉ cho phép template Node `published`; DS guard là lớp 2.

## Superadmin UI

Panel category hiện có mở rộng:

- Badge: Nháp / Đã duyệt / Đã ngừng.
- **Xem trước** → blob tab mới.
- **Xuất bản** chỉ khi `draft` (+ confirm).
- **Ngừng dùng**: `published` → retire; `draft` cũng được retire (bỏ nháp không publish).
- Upload, inspect fields, catalog: giữ.

Luồng: Upload → Xem trước → (sai: upload version mới, `name` giữ, `version` tăng) → Xuất bản.

## App đơn vị

- Picker chỉ `published`.
- Empty state: liên hệ Superadmin (đã có).
- Không preview/publish trên UI đơn vị.

## Ngoài phạm vi

- Persist `field_sources` / `signature_block` trên template.
- Form cấu hình mapping trên Superadmin.
- File Excel skeleton Named Range.
- Đưa `published` về `draft`.
- UI embed PDF trong panel.

## Kiểm thử

- DS: placeholder sinh đủ cột; publish 409 khi lặp; documents 409 khi draft; preview trả PDF bytes.
- Node: list unit chỉ published; publish/retire sync status; preview proxy.
- Smoke: Superadmin upload → preview tab → publish → unit thấy mẫu; retire → unit không thấy; export draft bị chặn.

## Tiêu chí xong

1. Upload mới không dùng được xuất chứng từ cho đến khi publish.
2. Preview = cùng `render_pdf` với dữ liệu mẫu, không lưu.
3. Unit chỉ chọn `published`; `isActive` không còn trên `ChungTuPdfTemplate`.
4. Superadmin có Xem trước / Xuất bản / Ngừng dùng (retire).
