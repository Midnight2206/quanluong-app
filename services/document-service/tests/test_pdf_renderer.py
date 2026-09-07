import importlib
from io import BytesIO

from pypdf import PdfReader

from conftest import make_minimal_template
from app.pagination import plan_pages
from app.render.demo_template import (
    CARRY_HEIGHT,
    HEADER_HEIGHT,
    MIN_ROWS_LAST_PAGE,
    ROW_HEIGHT_MAX,
    ROW_HEIGHT_MIN,
    SIGNATURE_HEIGHT,
    content_height_continuation,
    content_height_page1,
)
from app.render.draw import draw_table_header_frame
from app.render.pdf_renderer import (
    _RenderColumn,
    _draw_table_header,
    _table_start_y,
    render_demo_pdf,
    render_pdf,
)
from app.template.demo_metadata import build_demo_metadata
from app.template.metadata import FieldMeta, StaticCellMeta
from app.template.page_size import page_dimensions


def _sample_fields():
    return {
        "tieu_de": "PHIẾU XUẤT KHO DEMO",
        "don_vi": "Bếp ăn A",
        "ngay_thang": "17/08/2026",
        "so_phieu": "PX-001",
    }


def _sample_rows(n):
    return [
        {
            "stt": str(i + 1),
            "ten_hang": f"Mặt hàng {i + 1}",
            "don_vi_tinh": "kg",
            "so_luong": "10",
            "thanh_tien": "100000",
        }
        for i in range(n)
    ]


def test_pdf_magic_bytes():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=_sample_rows(3))

    assert pdf[:4] == b"%PDF"


def test_imported_minimal_template_renders_pdf():
    importer = importlib.import_module("app.import.template_importer")
    metadata = importer.parse_template(
        make_minimal_template(), name="chung-tu", version="1"
    )
    metadata.fields[0].font["size"] = None

    pdf = render_pdf(metadata=metadata, fields={"don_vi": "Bếp A"}, rows=[])

    assert pdf.startswith(b"%PDF")


def test_multi_row_header_repeats_on_continuation_pages():
    from test_template_importer import _make_pnk_like_two_row_header

    importer = importlib.import_module("app.import.template_importer")
    metadata = importer.parse_template(
        _make_pnk_like_two_row_header(), name="chung-tu", version="1"
    )
    rows = [
        {
            "stt": str(i + 1),
            "ten_hang": f"Hang {i + 1}",
            "dvt": "kg",
            "so_luong": "10",
            "ghi_chu": "",
        }
        for i in range(80)
    ]

    pdf = render_pdf(metadata=metadata, fields={"don_vi": "Bep A"}, rows=rows)
    pages = PdfReader(BytesIO(pdf)).pages

    assert len(pages) >= 2
    for page in pages:
        text = page.extract_text() or ""
        assert "TT" in text
        assert "Số lượng" in text
        assert "Yêu cầu" in text
        assert "Thực nhập" in text


def test_vietnamese_text_extracted():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=_sample_rows(1))

    text = "".join(page.extract_text() or "" for page in PdfReader(BytesIO(pdf)).pages)
    assert "Đơn vị" in text
    assert "Thành tiền" in text


def test_pdf_draws_auto_amount_in_words_and_skips_manual_scalar_field():
    metadata = build_demo_metadata()
    metadata.fields.append(
        FieldMeta(
            field_name="tong_tien_bang_chu",
            sheet_name="demo",
            cell_ref="A20",
            x=metadata.page.margin_left,
            y=120.0,
            below_table=True,
        )
    )
    fields = {
        **_sample_fields(),
        "tong_tien_bang_chu": "SHOULD_NOT_APPEAR",
    }

    pdf = render_pdf(metadata=metadata, fields=fields, rows=_sample_rows(3))

    text = "".join(page.extract_text() or "" for page in PdfReader(BytesIO(pdf)).pages)
    normalized = text.replace("\n", " ")
    assert "Tổng số tiền (Viết bằng chữ):" in normalized
    assert "SHOULD_NOT_APPEAR" not in normalized


def test_multi_page_pdf_matches_first_page_plan():
    rows = _sample_rows(45)
    pdf = render_demo_pdf(fields=_sample_fields(), rows=rows)
    expected = plan_pages(
        n_rows=len(rows),
        page_content_height=content_height_page1(),
        continuation_content_height=content_height_continuation(),
        header_height=HEADER_HEIGHT,
        carry_row_height=CARRY_HEIGHT,
        signature_block_height=SIGNATURE_HEIGHT,
        row_height_min=ROW_HEIGHT_MIN,
        row_height_max=ROW_HEIGHT_MAX,
        min_rows_last_page=MIN_ROWS_LAST_PAGE,
    )
    actual_pages = PdfReader(BytesIO(pdf)).pages

    assert len(actual_pages) == len(expected.pages) >= 2
    assert [
        (page.extract_text() or "").count("Mặt hàng") for page in actual_pages
    ] == [len(page.row_indices) for page in expected.pages]
    assert len(expected.pages[-1].row_indices) >= MIN_ROWS_LAST_PAGE


def test_three_rows_single_page():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=_sample_rows(3))

    assert len(PdfReader(BytesIO(pdf)).pages) == 1


def test_empty_rows_one_page():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=[])

    assert len(PdfReader(BytesIO(pdf)).pages) == 1


class _FakeCanvas:
    def __init__(self):
        self.lines = []

    def setLineWidth(self, *_args, **_kwargs):
        return None

    def setFont(self, *_args, **_kwargs):
        return None

    def drawString(self, *_args, **_kwargs):
        return None

    def line(self, x1, y1, x2, y2):
        self.lines.append((x1, y1, x2, y2))

    def rect(self, x, y, width, height, stroke=1, fill=0):
        self.lines.extend(
            [
                (x, y, x + width, y),
                (x + width, y, x + width, y + height),
                (x + width, y + height, x, y + height),
                (x, y + height, x, y),
            ]
        )


def test_header_top_border_drawn_on_every_page():
    metadata = build_demo_metadata()
    _, page_height = page_dimensions(metadata.page)
    columns = [
        _RenderColumn(key=c.key, title=c.title, width=c.width_pt, align=c.align_h)
        for c in metadata.table.columns
    ]
    table_left = metadata.page.margin_left
    table_width = sum(c.width for c in columns)
    header_cells = [
        StaticCellMeta(
            layer="header",
            row=5,
            x=table_left,
            y=100,
            width_pt=table_width,
            height_pt=metadata.table.header_height_pt,
            value="STT",
            border={"left": "thin", "right": "thin", "bottom": "thin", "top": None},
        )
    ]

    tops = []
    for page_index in (0, 1, 2):
        pdf = _FakeCanvas()
        y = _table_start_y(page_index, page_height, metadata)
        _draw_table_header(
            pdf,
            y=y,
            metadata=metadata,
            columns=columns,
            header_cells=header_cells,
            table_left=table_left,
            table_width=table_width,
        )
        expected_top = y
        matching = [
            line
            for line in pdf.lines
            if abs(line[1] - expected_top) < 0.01
            and abs(line[3] - expected_top) < 0.01
            and min(line[0], line[2]) == table_left
            and max(line[0], line[2]) == table_left + table_width
        ]
        assert matching, f"thiếu khung header trang {page_index + 1} tại y={expected_top}"
        tops.append(expected_top)

    assert tops[0] < tops[1] == tops[2]


def test_header_frame_skipped_when_template_has_no_borders():
    metadata = build_demo_metadata()
    metadata.table.row_style = {
        "header_border": {
            "left": None,
            "right": None,
            "top": None,
            "bottom": None,
        },
        "border": {"left": None, "right": None, "top": None, "bottom": None},
    }
    _, page_height = page_dimensions(metadata.page)
    columns = [
        _RenderColumn(key=c.key, title=c.title, width=c.width_pt, align=c.align_h)
        for c in metadata.table.columns
    ]
    table_left = metadata.page.margin_left
    table_width = sum(c.width for c in columns)
    pdf = _FakeCanvas()
    y = _table_start_y(0, page_height, metadata)
    _draw_table_header(
        pdf,
        y=y,
        metadata=metadata,
        columns=columns,
        header_cells=[],
        table_left=table_left,
        table_width=table_width,
    )
    assert pdf.lines == []


def test_draw_table_header_frame_is_rectangle():
    pdf = _FakeCanvas()
    draw_table_header_frame(pdf, x=36, y_top=800, width=500, height=24)
    assert len(pdf.lines) == 4