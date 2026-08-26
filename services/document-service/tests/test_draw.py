from io import BytesIO

from pypdf import PdfReader
from reportlab.pdfgen import canvas

from app.render.demo_template import DEMO_COLUMNS
from app.render.draw import draw_merged_cell, draw_static_cell, draw_table_row
from app.render.fonts import FONT_REGULAR


class _SpyCanvas:
    def __init__(self):
        self.lines = []
        self.rects = []
        self.strings = []

    def setLineWidth(self, *_a, **_k):
        return None

    def setFont(self, *_a, **_k):
        return None

    def drawString(self, x, y, text):
        self.strings.append((x, y, text))

    def line(self, x1, y1, x2, y2):
        self.lines.append((x1, y1, x2, y2))

    def rect(self, x, y, width, height, stroke=1, fill=0):
        self.rects.append((x, y, width, height))


def test_draw_merged_cell_smoke():
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(200, 100))
    draw_merged_cell(
        pdf,
        x=10,
        y=10,
        width=180,
        height=30,
        text="Đơn vị",
        font_name=FONT_REGULAR,
        font_size=10,
    )
    pdf.save()
    reader = PdfReader(BytesIO(buffer.getvalue()))
    assert len(reader.pages) == 1
    assert "Đơn vị" in (reader.pages[0].extract_text() or "")


def test_draw_table_row_smoke():
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(500, 100))
    draw_table_row(
        pdf,
        x=10,
        y=10,
        height=20,
        columns=[col.title for col in DEMO_COLUMNS],
        values={},
        col_defs=DEMO_COLUMNS,
        font_name=FONT_REGULAR,
        font_size=10,
    )
    pdf.save()
    text = PdfReader(BytesIO(buffer.getvalue())).pages[0].extract_text() or ""
    assert "STT" in text
    assert "Thành tiền" in text


def test_static_cell_with_text_but_no_excel_border_draws_nothing():
    spy = _SpyCanvas()
    draw_static_cell(
        spy,
        x=10,
        y=20,
        width=100,
        height=30,
        value="Tiêu đề",
        border={"left": None, "right": None, "top": None, "bottom": None},
    )
    assert spy.rects == []
    assert spy.lines == []
    assert spy.strings


def test_table_row_respects_empty_border_dict():
    spy = _SpyCanvas()
    draw_table_row(
        spy,
        x=0,
        y=0,
        height=20,
        columns=["A", "B"],
        values={},
        col_defs=DEMO_COLUMNS[:2],
        font_name=FONT_REGULAR,
        font_size=10,
        border={},
    )
    assert spy.rects == []
    assert spy.lines == []


def test_data_row_valign_middle_centers_text_vertically():
    spy = _SpyCanvas()
    height = 40.0
    font_size = 10.0
    draw_merged_cell(
        spy,
        x=0,
        y=0,
        width=80,
        height=height,
        text="X",
        font_name=FONT_REGULAR,
        font_size=font_size,
        valign="middle",
        border={},
    )
    assert len(spy.strings) == 1
    _, text_y, _ = spy.strings[0]
    # middle: baseline gần giữa ô (height=40 → ~16–20 tùy line-height)
    assert 14.0 <= text_y <= 22.0
