# Document microservice P3 — Template Importer + TemplateMetadata

Ngày: 2026-08-17 (bản chuẩn hóa sau review)
Tiếp theo: `2026-08-17-document-service-p2-design.md` (PDF Renderer synthetic)
Quyết định Named Range / BlobStore / validate: chốt trong P2 spec (mục «Quyết định chốt cho P3») — **tài liệu này là spec triển khai P3**.

## Mục tiêu P3

Đọc file `.xlsx` theo quy ước Named Range → sinh **`TemplateMetadata`** (hợp đồng chung Importer ↔ Renderer). Refactor nhẹ P2 để renderer đọc metadata thay vì hardcode cột trực tiếp. Persist metadata vào Postgres qua `import_template()` — **chưa HTTP upload**, **chưa MinIO thật**, **chưa** API tạo PDF.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Thứ tự triển khai | 1) `TemplateMetadata` → 2) refactor `demo_template` → 3) importer `.xlsx` → 4) persist DB |
| Field Named Range | `FIELD_<ten_field>` — prefix bắt buộc; `field_name` = phần sau prefix, **snake_case không dấu** |
| Bảng Named Range | `TABLE_HEADER`, `TABLE_DATA_ROW`, `TABLE_SIGNATURE` (vị trí khối chữ ký) |
| Validate bắt buộc | Luôn có `TABLE_HEADER` + `TABLE_DATA_ROW`; thiếu → `TemplateValidationError` |
| `TABLE_SIGNATURE` | Thiếu → **default** `signature_block_height_pt = 80` (như P2); không raise |
| Field bắt buộc nghiệp vụ | **Không** ở P3; import mọi `FIELD_*` tìm được |
| `required_fields` | Param `list[str] \| None = None` trên `import_template()` — **có sẵn, chưa dùng** ở P3 |
| Blob | `BlobStore` ABC (`save`, `load`); P3 dùng `NullBlobStore` → `file_path = null` |
| HTTP / MinIO | Ngoài P3 |
| Renderer | Refactor **nhẹ**: đọc `TemplateMetadata`; giữ `render_demo_pdf()` wrapper cho test P2 |
| Phạm vi sheet | **P3 chỉ hỗ trợ 1 sheet** cho toàn bộ `TABLE_HEADER` / `TABLE_DATA_ROW` / `TABLE_SIGNATURE` — phải cùng sheet. Field đơn lẻ (`FIELD_*`) có thể ở sheet khác |
| Cấu trúc cột | `width_pt` mỗi cột = tổng độ rộng point của **các cột Excel bị merge** trong cell header đó (không phải 1 cột đơn lẻ) |

## Kiến trúc P3

```
app/template/
├── metadata.py          # TemplateMetadata, FieldMeta, ColumnMeta, TableMeta, PageMeta
├── demo_metadata.py     # demo_template.py refactor → build_demo_metadata()
└── (shared types used by render + import)

app/import/
├── blob.py              # BlobStore ABC, NullBlobStore
├── excel_coords.py      # column width / row height → point; cell → (x, y) ReportLab
├── template_importer.py # parse xlsx bytes → TemplateMetadata
├── errors.py            # TemplateValidationError
└── template_service.py  # import_template(session, ...) → template_id

app/render/
├── pdf_renderer.py      # render_pdf(metadata, fields, rows) — refactor từ render_demo_pdf
└── demo_template.py     # giữ constants tạm hoặc mỏng — delegate demo_metadata

tests/
├── fixtures/templates/minimal_template.xlsx
├── fixtures/templates/mismatched_columns.xlsx   # TABLE_HEADER/DATA_ROW lệch cột — test validate
├── test_excel_coords.py
├── test_template_metadata.py
├── test_template_importer.py
└── test_template_service.py
```

**Luồng end-to-end (P3, không HTTP):**

1. `metadata = parse_template(xlsx_bytes)` hoặc `build_demo_metadata()`
2. `pdf = render_pdf(metadata, fields, rows)` — test importer + renderer cùng schema
3. `template_id = import_template(session, name, version, xlsx_bytes, blob_store=NullBlobStore())`
4. Ghi `templates`, `template_fields`, `template_table_config`

## Named Range

| Named Range | Vai trò |
|-------------|---------|
| `FIELD_<name>` | Ô field đơn; `<name>` → `field_name` (validate snake_case) |
| `TABLE_HEADER` | 1 dòng tiêu đề — suy `column_defs` (key, title, width_pt, align) |
| `TABLE_DATA_ROW` | 1 dòng mẫu — style copy cho dòng data (`data_row_template`, border/font) |
| `TABLE_SIGNATURE` | Vị trí bắt đầu khối chữ ký — tính `signature_block_height_pt` |

Named Range khác (`Print_Area`, hoặc range không theo quy ước trên) → **bỏ qua**, không lỗi.

P3 chỉ hỗ trợ **single rectangular range** cho mỗi tên bắt buộc — nhiều vùng rời rạc cùng tên → `TemplateValidationError`.

### Ràng buộc cấu trúc giữa `TABLE_HEADER` và `TABLE_DATA_ROW`

Trước khi build `TableMeta`, importer phải validate:

1. **Cùng sheet** — `TABLE_HEADER`, `TABLE_DATA_ROW`, `TABLE_SIGNATURE` (nếu có) phải trỏ về cùng 1 `sheet_name`. Khác sheet → `TemplateValidationError`.
2. **Cùng số cột** — số cell/merge-group trong `TABLE_HEADER` phải bằng số cell/merge-group trong `TABLE_DATA_ROW`. Lệch → `TemplateValidationError` (kèm số cột 2 bên trong message).
3. **Cùng biên trái/phải theo cột Excel** — merge-group thứ *i* của `TABLE_HEADER` và `TABLE_DATA_ROW` phải bắt đầu/kết thúc ở cùng cột Excel (đảm bảo width tính từ header áp đúng cho data row). Lệch → `TemplateValidationError`.
4. **Thứ tự trái → phải** — cột dùng đúng thứ tự đọc từ trái sang phải theo tọa độ cột Excel, không phụ thuộc thứ tự khai báo trong file.

## TemplateMetadata (hợp đồng chung)

```python
@dataclass
class FieldMeta:
    field_name: str
    sheet_name: str
    cell_ref: str
    x: float
    y: float              # ReportLab (y từ đáy)
    font: dict | None
    align: dict | None
    border: dict | None

@dataclass
class ColumnMeta:
    key: str              # snake_case slug từ header text
    title: str
    width_pt: float        # tổng width các cột Excel bị merge trong cell header
    align_h: str           # left|center|right

@dataclass
class TableMeta:
    sheet_name: str
    header_row_range: str
    data_row_template: str
    columns: list[ColumnMeta]
    row_style: dict | None
    header_height_pt: float
    carry_height_pt: float = 18
    signature_block_height_pt: float = 80
    row_height_min: float = 18
    row_height_max: float = 28
    min_rows_last_page: int = 2
    stretch_strategy: str = "end_bias"

@dataclass
class PageMeta:
    page_size: str = "A4"
    orientation: str = "portrait"
    margin_top: float = 40
    margin_right: float = 36
    margin_bottom: float = 40
    margin_left: float = 36
    static_block_height_pt: float = 80  # field block page 1

@dataclass
class TemplateMetadata:
    name: str
    version: str
    page: PageMeta
    fields: list[FieldMeta]
    table: TableMeta
```

**Column key:** slug header text → `ten_hang`; trùng → suffix `_2`. Validate `[a-z0-9_]+`.

## Quy đổi Excel → point (`excel_coords.py`)

| Excel | P3 |
|-------|-----|
| Column width (char units) | `width_pt = max(10, col_width * 7)` — heuristic tạm thời, cần hiệu chỉnh khi có template thật ở P4 |
| Cột header bị merge (VD 3 cột Excel) | `width_pt` = tổng `width_pt` của từng cột Excel trong merge range đó |
| Row height | Lấy point trực tiếp nếu `row_dimensions[r].height` có set; nếu không, dùng default 15pt |
| Cell (x, y) | Tích lũy width/height các cột/dòng trước đó từ góc trên-trái sheet; sau đó flip trục Y để khớp gốc tọa độ ReportLab (đáy trang) |
| `signature_block_height_pt` (khi có `TABLE_SIGNATURE`) | = khoảng cách từ `y` (đáy, sau flip) của dòng bắt đầu `TABLE_SIGNATURE` đến `margin_bottom` của trang — tức toàn bộ phần còn lại phía dưới trang tính từ vị trí đó |
| Page margins | `ws.page_margins` (inch) × 72 nếu có set; else dùng default P2 |

## BlobStore

```python
class BlobStore(ABC):
    @abstractmethod
    def save(self, key: str, content: bytes) -> str | None: ...
    @abstractmethod
    def load(self, key: str) -> bytes: ...

class NullBlobStore(BlobStore):
    def save(self, key, content): return None
    def load(self, key): raise NotImplementedError
```

- Key: `templates/{name}/{version}.xlsx`
- P3: `NullBlobStore` → `templates.file_path = null`
- P4+: `MinIOBlobStore` — không sửa `template_importer` / `template_service` signature

## import_template (service)

```python
def import_template(
    session: Session,
    *,
    name: str,
    version: str,
    xlsx_bytes: bytes,
    blob_store: BlobStore | None = None,
    required_fields: list[str] | None = None,
) -> int:
    ...
```

1. `blob_store = blob_store or NullBlobStore()`
2. `blob_store.save(key, xlsx_bytes)` (no-op ở P3)
3. `metadata = parse_template(xlsx_bytes, name=name, version=version)`
   - Validate `TABLE_HEADER` / `TABLE_DATA_ROW` tồn tại, cùng sheet, cùng cấu trúc cột (xem mục "Ràng buộc cấu trúc")
4. `required_fields` check — **skip nếu `None`** (P3)
5. Map `TemplateMetadata` → ORM rows; `commit`
6. Return `template_id`

## Refactor renderer (nhẹ)

- `render_pdf(metadata: TemplateMetadata, *, fields, rows) -> bytes` — logic từ `render_demo_pdf`
- `render_demo_pdf(...)` — gọi `build_demo_metadata()` + `render_pdf` (test P2 không gãy)
- Planner input lấy từ `metadata.page` + `metadata.table` (giữ `content_height_page1()` cho trang 1)

## Xử lý lỗi

| Tình huống | Hành vi |
|-----------|---------|
| File corrupt / không phải `.xlsx` | `ValueError` |
| Thiếu `TABLE_HEADER` / `TABLE_DATA_ROW` | `TemplateValidationError` (tiếng Việt) |
| `TABLE_HEADER` / `TABLE_DATA_ROW` khác sheet | `TemplateValidationError` |
| Số cột `TABLE_HEADER` ≠ `TABLE_DATA_ROW` | `TemplateValidationError` (kèm số cột 2 bên) |
| Biên cột lệch giữa `TABLE_HEADER` và `TABLE_DATA_ROW` | `TemplateValidationError` |
| Named range không phải hình chữ nhật đơn / nhiều vùng rời rạc | `TemplateValidationError` |
| `field_name` không đúng `[a-z0-9_]+` | `TemplateValidationError` |
| `required_fields` thiếu (khi param được set) | `TemplateValidationError` — dùng thật từ **P4+** |

Không thêm route FastAPI; `main.py` không đổi ở P3.

## Nghiệm thu P3

1. `pytest` pass toàn bộ (P1+P2+P3); không regression PDF demo
2. `build_demo_metadata()` tương đương layout P2 (cùng số cột, render PDF pass test cũ)
3. Parse `minimal_template.xlsx` → ≥2 `FIELD_*`, 5 columns, `TemplateMetadata` hợp lệ, width cột merge tính đúng
4. Thiếu `TABLE_HEADER` → `TemplateValidationError`
5. `mismatched_columns.xlsx` (header/data lệch số cột) → `TemplateValidationError`
6. `import_template` với mock session → 1 template + fields + table_config; `file_path` null
7. `excel_coords`: ≥1 unit test width có merge, ≥1 unit test `signature_block_height_pt`
8. Không route HTTP mới

## Ngoài P3 (P4+)

P4: xem **`2026-08-17-document-service-p4-design.md`** (HTTP upload + PDF từ DB).

- MinIO / `MinIOBlobStore`
- `required_fields` theo loại chứng từ (document type)
- Node client / FE
- pdfplumber QA (P5)
- Hiệu chỉnh heuristic `width_pt = col_width * 7`
- Hỗ trợ nhiều sheet cho vùng bảng (nếu phát sinh nhu cầu)

## Mapping DB (persist)

| TemplateMetadata | DB |
|------------------|-----|
| `page` + name/version | `templates` |
| `fields[]` | `template_fields` |
| `table.*` | `template_table_config` (`column_defs` JSON từ `columns`) |
| blob save result | `file_path` (null ở P3) |