# Document microservice P2 — PDF Renderer (demo synthetic)

Ngày: 2026-08-17  
Tiếp theo: `2026-08-17-document-service-p1-design.md` (Pagination Engine + Postgres schema)  
Roadmap đầy đủ (P3–P6): Template Importer, API tạo chứng từ, MinIO, QA, nối sổ — **ngoài phạm vi P2**.

## Mục tiêu P2

Thêm **PDF Renderer** (ReportLab) với **1 template synthetic hardcode** trong code: field đơn + bảng 5 cột + phân trang (dùng `PaginationResult` từ P1). Ra file PDF thật qua unit test — **chưa HTTP endpoint**, chưa importer, chưa MinIO.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Template | **Synthetic trong code** — không cần `.xlsx` |
| Font | **DejaVu Sans** — đóng gói `.ttf` vào `services/document-service/fonts/` |
| API | **Module thuần** `render_demo_pdf()` → `bytes`; unit test only |
| Mẫu demo | Chứng từ generic: tiêu đề, đơn vị, ngày, số phiếu + bảng 5 cột + cộng chuyển + chữ ký |
| Kiến trúc code | **Tách draw helpers + demo template** (khuyến nghị cách 2) |
| Merge cell P2 | Chỉ merge hình chữ nhật đơn (tiêu đề, carry, cộng, chữ ký) |
| QA | `pypdf` đếm trang + extract text; **không** pdfplumber (P5) |
| Pagination P1 | **Không sửa** — renderer là consumer |

## Kiến trúc P2

```
app/render/
├── fonts.py           # register DejaVuSans + DejaVuSans-Bold
├── draw.py            # draw_text, draw_rect_border, draw_merged_cell
├── demo_template.py   # DEMO_TEMPLATE: A4, margins, fields, columns, block heights
└── pdf_renderer.py    # render_demo_pdf(fields, rows) -> bytes

app/pagination/        # giữ nguyên P1
tests/
└── test_pdf_renderer.py
```

**Luồng render:**

1. Input `fields: dict[str, str]`, `rows: list[dict[str, str]]`
2. `plan_pages()` với config chiều cao từ `demo_template`
3. ReportLab `canvas.Canvas(BytesIO)` — mỗi trang:
   - Trang 1: field tĩnh (tiêu đề, đơn vị, ngày, số phiếu)
   - Header bảng (lặp mỗi trang)
   - Dòng «Mang từ trang trước» nếu có
   - Dòng data theo `PagePlan.row_indices` / `row_heights`
   - Dòng «Cộng chuyển trang sau» nếu chưa trang cuối
   - Trang cuối: dòng «Cộng» + khối chữ ký
4. Trả `bytes` PDF

## Trang & margin

| Thuộc tính | Giá trị |
|-----------|---------|
| `page_size` | A4 (595 × 842 pt) |
| `orientation` | portrait |
| Margin | top 40, right 36, bottom 40, left 36 (point) |
| Vùng nội dung khả dụng | ~523 × 762 pt |

## Field đơn (chỉ trang 1)

Tọa độ ReportLab: `y` từ **đáy** trang. `field_name` khớp key `fields` — sau này map `template_fields.field_name`.

| `field_name` | Hiển thị | Vị trí (x, y) | Font |
|--------------|----------|---------------|------|
| `tieu_de` | «PHIẾU XUẤT KHO DEMO» (merge, căn giữa) | (36, 802) | DejaVuSans-Bold 14pt |
| `don_vi` | «Đơn vị: {value}» | (36, 778) | DejaVuSans 10pt |
| `ngay_thang` | «Ngày: {value}» | (400, 778) | DejaVuSans 10pt |
| `so_phieu` | «Số phiếu: {value}» | (36, 762) | DejaVuSans 10pt |

Field thiếu key → vẽ chuỗi rỗng (không raise ở P2).

## Bảng dữ liệu

**Cột** (`rows` key → tiêu đề → width pt → căn ngang):

| Key | Tiêu đề | Width | Align |
|-----|---------|-------|-------|
| `stt` | STT | 36 | center |
| `ten_hang` | Tên hàng | 200 | left |
| `don_vi_tinh` | ĐVT | 50 | center |
| `so_luong` | SL | 60 | right |
| `thanh_tien` | Thành tiền | 90 | right |

**Chiều cao khối** (input `plan_pages`):

| Khối | Height (pt) |
|------|-------------|
| Header bảng | 22 |
| Dòng carry | 18 |
| Khối chữ ký (trang cuối) | 80 |
| Dòng data | theo `PaginationResult` (18–28, `end_bias`) |

- Header lặp mỗi trang; border grid cơ bản
- Dòng carry: merge 5 cột, italic 9pt
- Trang cuối: «Cộng» merge bold + 2 cột chữ ký («Người lập» / «Thủ trưởng đơn vị»)

`page_content_height` cho planner = chiều cao vùng nội dung trừ field tĩnh trang 1 (chỉ trừ một lần ở trang đầu); các trang sau full vùng bảng.

## Contract API (Python, nội bộ)

```python
def render_demo_pdf(
    *,
    fields: dict[str, str],
    rows: list[dict[str, str]],
) -> bytes:
    ...
```

- `rows` rỗng → PDF 1 trang (field + header + chữ ký, không dòng data)
- Renderer không gọi DB / HTTP

## Font & Docker

```
services/document-service/fonts/
├── DejaVuSans.ttf
└── DejaVuSans-Bold.ttf
```

- Nguồn: [DejaVu fonts](https://dejavu-fonts.github.io/) (SIL OFL)
- `fonts.py`: `pdfmetrics.registerFont` + `registerFontFamily` khi import
- `Dockerfile`: `COPY fonts ./fonts`
- Không dùng font hệ thống container

**Dependencies mới:**

- `reportlab>=4,<5` (runtime)
- `pypdf>=5,<6` (dev/test — đếm trang, extract text)

## Xử lý lỗi

| Tình huống | Hành vi |
|-----------|---------|
| Font `.ttf` thiếu | `RuntimeError` «Không tìm thấy font DejaVuSans» |
| Pagination không khả thi | `ValueError` từ `plan_pages` (P1) |
| `rows` / phần tử sai kiểu | `TypeError` / `ValueError` |

Không thêm route FastAPI; `main.py` không đổi ở P2.

## Nghiệm thu P2

1. `pytest` pass toàn bộ (P1 + P2)
2. `render_demo_pdf()` trả bytes bắt đầu `%PDF`
3. `pypdf`: số trang khớp `len(plan_pages(...).pages)`
4. Extract text chứa chuỗi tiếng Việt có dấu (vd. «Đơn vị», «Thành tiền»)
5. 45 dòng demo → ≥2 trang; trang cuối ≥2 dòng data (15 dòng là 1 trang với chiều cao hiện tại)
6. 3 dòng demo → 1 trang
7. Font trong repo; Docker build OK
8. Không regression `/v1/parse`, `/v1/export`, `/v1/pagination/plan`

## Ngoài P2 (P3+)

- `POST /v1/render/*`, `POST /templates/{id}/documents`
- Template Importer + Named Range
- Metadata từ Postgres thay `demo_template.py`
- MinIO, `documents.pdf_path`
- Node client PDF
- pdfplumber QA (P5)
- Nối sổ nhiều chứng từ (P6)
- Vertical align phức tạp — P2: top/middle đơn giản

## Checklist mở (chốt trước P3)

- [ ] Naming convention Named Range field đơn lẻ
- [ ] Named Range vùng bảng (`DATA_TABLE_HEADER` / `DATA_TABLE_START`)
- [ ] Danh sách field bắt buộc mọi template (validate import)
