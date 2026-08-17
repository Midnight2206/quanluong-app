from io import BytesIO

from pypdf import PdfReader
from reportlab.pdfgen import canvas

from app.render.demo_template import DEMO_COLUMNS
from app.render.draw import draw_merged_cell, draw_table_row
from app.render.fonts import FONT_REGULAR


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
    )
    pdf.save()
    text = PdfReader(BytesIO(buffer.getvalue())).pages[0].extract_text() or ""
    assert "STT" in text
    assert "Thành tiền" in text
