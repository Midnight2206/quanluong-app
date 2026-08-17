# Document microservice P1 — nền tảng + Pagination Engine

Ngày: 2026-08-17  
Supersedes (rename): `2026-08-16-excel-microservice-design.md` — khung parse/export được **hấp thụ** vào service này; không còn `excel-service` riêng sau khi implement P1.  
Roadmap đầy đủ (P2–P6): kế hoạch user «Excel Template → PDF» (Importer, ReportLab, MinIO, API chứng từ, QA, sổ nhiều trang) — **ngoài phạm vi P1**.

## Mục tiêu P1

Đổi `services/excel-service` → `services/document-service`: giữ parse/export `.xlsx`, thêm PostgreSQL + schema mẫu chứng từ, và **Pagination Engine** thuần (unit test + HTTP plan) — chưa PDF, chưa import template, chưa MinIO.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Quan hệ excel-service | **Thay thế**: rename → `document-service`; giữ `/v1/parse`, `/v1/export` |
| Phạm vi vòng 1 | **Chỉ P1** |
| DB | PostgreSQL 16 riêng (`document-db`), không dùng MariaDB app |
| Blob / PDF | Chưa MinIO, chưa ReportLab |
| `documents` | Có bảng stub; **không** API lưu PDF ở P1 |
| Chiều cao dòng | `row_height_min=18`, `row_height_max=28` (point) |
| Chiến lược giãn | **`end_bias`** — ưu tiên giãn dòng gần cuối trang/chứng từ |
| Trang cuối | `min_rows_last_page=2` |
| Gọi | HTTP nội bộ; `X-Service-Key`; FE không gọi trực tiếp |
| Node env | Đổi `EXCEL_SERVICE_*` → `DOCUMENT_SERVICE_*` (đổi hẳn) |
| Compose depends_on | `document` với `service_started` (không chặn BE bằng health) |

## Kiến trúc P1

```
Node BE ──X-Service-Key──► document:8000 (FastAPI)
                              │
                              ├── /health, /v1/parse, /v1/export  (giữ)
                              ├── /v1/pagination/plan             (mới)
                              ├── /v1/templates                   (list stub/DB)
                              └── document-db (Postgres)
```

Thư mục: `services/document-service/` (rename từ excel-service).

## Schema (Alembic)

### `templates`
`id`, `name`, `version`, `file_path` (nullable), `page_size`, `orientation`, `margin_top/right/bottom/left`, `created_at`

### `template_fields`
`id`, `template_id` FK, `field_name`, `sheet_name`, `cell_ref`, `x`, `y`, font/align/border JSON — P1 có thể chưa có row thật

### `template_table_config`
`id`, `template_id` FK, `header_row_range`, `data_row_template`, `column_defs` JSON, `subtotal_row_style` JSON, `signature_block_height`, `row_height_min` (default 18), `row_height_max` (default 28), `min_rows_last_page` (default 2), `stretch_strategy` (default `end_bias`)

### `documents` (stub)
`id`, `template_id` FK, `data` JSONB, `pdf_path` nullable, `created_at` — không endpoint tạo ở P1

## Pagination Engine

**Module:** `app/pagination/page_planner.py` — không phụ thuộc Excel/PDF/DB.

### Input (logic)
- `n_rows: int`
- `page_content_height: float` — chiều cao khả dụng một trang (đã trừ margin; caller trừ header lặp / carry / chữ ký theo trang)
- `header_height`, `carry_row_height`, `signature_block_height` (signature chỉ trừ trang cuối)
- `row_height_min`, `row_height_max`, `min_rows_last_page`, `stretch_strategy="end_bias"`

### Output

```text
PagePlan: page_index, row_indices[], row_heights[], has_carry_from_prev, has_carry_to_next, is_last
PaginationResult: pages[], strategy, row_height_min, row_height_max
```

### Thuật toán
1. Phân trang thử với `row_height_min` (trừ header mỗi trang; carry giữa trang; signature chỉ trang cuối).
2. Nếu trang cuối có số dòng dữ liệu &lt; `min_rows_last_page` → tăng chiều cao theo **end_bias** trong [min, max] rồi phân trang lại đến khi thỏa hoặc raise lỗi không khả thi (message tiếng Việt rõ).
3. Kết quả chốt — P2 renderer không đổi kế hoạch.

## API P1

| Method | Path | Auth | Hành vi |
|--------|------|------|---------|
| GET | `/health` | không | `{ ok, service: "document" }` |
| POST | `/v1/parse` | key | giữ như excel-service |
| POST | `/v1/export` | key | giữ |
| POST | `/v1/pagination/plan` | key | body → `PaginationResult` JSON |
| GET | `/v1/templates` | key | list từ DB (có thể rỗng) |

Chưa: `POST /templates`, `POST .../documents`, tải PDF.

Lỗi: envelope `{ "error": { "code", "message" } }` (giữ pattern excel-service).

## Node BE

- Client: `document-service.client.js` (rename từ excel); `parseWorkbook` / `exportWorkbook` giữ; thêm `planPagination(body)` tùy chọn.
- Config: `DOCUMENT_SERVICE_URL`, `DOCUMENT_SERVICE_KEY`, `DOCUMENT_SERVICE_TIMEOUT_MS`.
- Cập nhật `.env.example` / `.env.docker.example`; xóa hoặc ghi chú deprecated `EXCEL_SERVICE_*`.

## Compose

- `document-db`: Postgres 16, volume riêng, healthcheck.
- `document`: build `services/document-service`, env key + `DOCUMENT_DATABASE_URL`, **không** publish port host mặc định.
- `app.depends_on.document: service_started`.

## Nghiệm thu

1. Migrate Postgres OK; `document` + `document-db` lên được.
2. Unit test pagination: ≥2 dòng trang cuối; end_bias trong [18, 28]; case không khả thi có lỗi.
3. `POST /v1/pagination/plan` khớp kết quả unit test.
4. parse/export vẫn pass sau rename.
5. Node client `DOCUMENT_SERVICE_*` + test mock fetch pass.

## Ngoài P1 (P2+)

ReportLab PDF; MinIO; Template Importer + Named Range conventions; API tạo chứng từ; pdfplumber QA; nối sổ nhiều chứng từ; font tiếng Việt cụ thể (chốt trước P2).

## Checklist còn mở (chốt trước P3 / P2)

- [ ] Naming convention Named Range field đơn lẻ
- [ ] Named Range vùng bảng (`DATA_TABLE_HEADER` / `DATA_TABLE_START`…)
- [ ] Font `.ttf` tiếng Việt cụ thể (P2)
- [ ] Danh sách field bắt buộc mọi template (P3 validate)
