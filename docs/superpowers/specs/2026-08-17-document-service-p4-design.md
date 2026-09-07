# Document microservice P4 — HTTP upload + PDF từ DB

Ngày: 2026-08-17 (bản chuẩn hóa sau review)
Tiếp theo: `2026-08-17-document-service-p3-template-importer.md` (Importer + TemplateMetadata)
Roadmap P5–P6: MinIO, Node client, FE, pdfplumber QA, nối sổ — **ngoài phạm vi P4**.

## Mục tiêu P4

Expose HTTP: upload `.xlsx` → persist metadata (P3 `import_template`); tạo chứng từ từ template đã lưu → **PDF bytes**. Renderer đọc **Postgres**, không đọc `.xlsx` lúc render. **Chưa** MinIO, Node, FE; **không** ghi bảng `documents`.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Phạm vi | HTTP upload + tạo PDF từ DB |
| Blob | `NullBlobStore` — `file_path` null |
| Lịch sử | Không insert `documents`; chỉ trả PDF |
| Upload identity | Client gửi `name` + `version`; trùng → 400 |
| Auth | `X-Service-Key` (giữ nguyên cơ chế P1) |
| `required_fields` | Vẫn `None` |
| Node / FE / MinIO | Ngoài P4 |

## Kiến trúc

```
POST /v1/templates                 multipart file + name + version
GET  /v1/templates                 giữ P1
GET  /v1/templates/{id}
GET  /v1/templates/{id}/fields
POST /v1/templates/{id}/documents  JSON {fields, rows} → application/pdf
```

```
import_template()          # P3, unchanged signature
load_metadata_from_db()    # P4 mới: ORM → TemplateMetadata
render_pdf(metadata, ...)  # P3
```

Unique index Postgres `(templates.name, templates.version)`.

## API

Auth: `X-Service-Key` áp dụng cho mọi route trừ `/health` — theo đúng cơ chế đã có từ P1 (không đổi hành vi/status code, chỉ áp dụng thêm cho route mới). Lỗi format chung: `{ "error": { "code", "message" } }`.

### `POST /v1/templates`

Multipart: `file` (`.xlsx`, max 5 MB), `name`, `version`.

**Thứ tự validate** (dừng ở bước đầu tiên fail):
1. Auth (`X-Service-Key`)
2. Định dạng input: file có phải `.xlsx`, có vượt 5 MB, `name`/`version` có rỗng không
3. `TemplateValidationError` từ `parse_template` (Named Range, cấu trúc cột...)
4. Trùng `(name, version)` — check tồn tại trước insert, **và** có unique constraint DB làm lớp bảo vệ cuối (tránh race condition 2 request đồng thời)

**201:** `{ "id", "name", "version", "file_path": null }`

| Tình huống | Status | Code |
|-----------|--------|------|
| Thiếu/sai `X-Service-Key` | 401 | theo quy ước P1 hiện có |
| Không `.xlsx` / quá 5 MB / thiếu `name`/`version` | 400 | `BAD_REQUEST` (như `/v1/parse`) |
| `TemplateValidationError` (Named Range/cấu trúc sai) | 400 | `TEMPLATE_INVALID` |
| Trùng `(name, version)` | 400 | `TEMPLATE_EXISTS` — «Mẫu «{name}» phiên bản «{version}» đã tồn tại» |
| DB down | 502 | `DATABASE_UNAVAILABLE` |

### `GET /v1/templates/{id}`

**200:** như list item + `created_at`. **404** `NOT_FOUND`.

### `GET /v1/templates/{id}/fields`

**200:**

```json
{
  "fields": [{ "field_name": "don_vi", "cell_ref": "B2" }],
  "columns": [{ "key": "stt", "title": "STT", "align_h": "center" }]
}
```

Không trả tọa độ/font (đây là thông tin nội bộ render, không cần thiết cho client xây form nhập liệu). **404** nếu không có template.

### `POST /v1/templates/{id}/documents`

Body: `{ "fields": { "...": "..." }, "rows": [ { "stt": "1", ... } ] }`

**Xử lý field/cột không khớp:**
- `fields` thiếu key so với `template_fields` → vẽ chuỗi rỗng tại vị trí đó (giữ hành vi P2, không lỗi)
- `rows` — mỗi dòng thiếu key so với `columns` đã định nghĩa → vẽ ô rỗng (không lỗi)
- `rows` — mỗi dòng có **key thừa** không khớp `columns` nào → **bỏ qua âm thầm key thừa đó**, không raise lỗi (nguyên tắc: input thừa không phá vỡ render, vì client có thể gửi dữ liệu dùng chung cho nhiều mục đích khác trong tương lai)
- `rows` sai kiểu tổng thể (không phải list, hoặc phần tử không phải object) → 400 `BAD_REQUEST`

| Tình huống | Status | Code |
|-----------|--------|------|
| Template không tồn tại | 404 | `NOT_FOUND` |
| `rows`/`fields` sai kiểu tổng thể | 400 | `BAD_REQUEST` |
| Pagination không khả thi | 400 | `PAGINATION_FAILED` — message nguyên văn từ planner |

**200** `application/pdf`

**Filename (`Content-Disposition`):** dùng cả 2 dạng để tương thích ngược lẫn hỗ trợ Unicode đúng chuẩn RFC 5987, vì `name` template thường chứa tiếng Việt có dấu:
```
Content-Disposition: attachment; filename="document.pdf"; filename*=UTF-8''{name}-{version}.pdf (percent-encoded)
```
`filename=` dùng bản ASCII-safe fallback (VD `document.pdf`) cho client cũ không hỗ trợ `filename*`; `filename*=` dùng bản đầy đủ đã percent-encode UTF-8.

Không insert `documents`.

## `load_metadata_from_db`

| DB | Metadata |
|----|----------|
| `templates` | `PageMeta` + name/version |
| `template_fields` | `FieldMeta[]` (`label_prefix=""`) |
| `template_table_config` | `TableMeta` từ `column_defs` (JSON), heights, `data_row_style` |

Không có template → `None`. Render không mở `.xlsx`.

**Lưu ý deserialize JSON (`column_defs`):** phải giữ đúng **thứ tự cột** (dùng JSON array, không dùng object/dict — tránh phụ thuộc thứ tự key không đảm bảo) và đúng **kiểu dữ liệu số** (`width_pt` phải là `float`, không bị làm tròn thành `int` qua JSON round-trip). Viết test riêng cho việc này (xem mục Nghiệm thu #4).

## Schema

Alembic: unique `templates_name_version_key` trên `(name, version)`.

## Nghiệm thu

1. Unique `(name, version)` trên Postgres — insert trùng qua raw SQL cũng phải fail (không chỉ chặn ở tầng code)
2. Upload → GET fields → POST documents ra PDF (`%PDF`)
3. Trùng name/version → 400 `TEMPLATE_EXISTS`
4. **Round-trip test**: `parse_template(xlsx_bytes)` → `import_template()` → `load_metadata_from_db()` phải cho ra `TemplateMetadata` **tương đương** metadata gốc — so sánh field-by-field, đặc biệt: `width_pt` (kiểu `float`, giá trị không đổi), `align_h`, và **thứ tự** `columns` giữ nguyên như header gốc
5. `rows` chứa key thừa không khớp `columns` → không lỗi, cột thừa bị bỏ qua, PDF vẫn render đúng các cột hợp lệ
6. Renderer chỉ đọc DB (không gọi bất kỳ hàm mở `.xlsx` nào trong luồng `POST .../documents`)
7. `Content-Disposition` với `name` chứa tiếng Việt có dấu → header hợp lệ theo RFC 5987, không lỗi encode
8. Suite P1–P3 không regression

## Ngoài P4 (P5+)

- MinIO / `MinIOBlobStore`
- Node client
- FE
- Ghi `documents` / lưu PDF
- `required_fields` theo loại chứng từ
- pdfplumber QA
- Nối sổ nhiều chứng từ