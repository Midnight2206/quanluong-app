from reportlab.pdfbase import pdfmetrics

from app.render.fonts import FONT_BOLD, FONT_REGULAR


def test_fonts_registered():
    assert FONT_REGULAR in pdfmetrics.getRegisteredFontNames()
    assert FONT_BOLD in pdfmetrics.getRegisteredFontNames()
