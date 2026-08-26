from reportlab.pdfbase import pdfmetrics

from app.render.fonts import FONT_BOLD, FONT_BOLD_ITALIC, FONT_ITALIC, FONT_REGULAR


def test_fonts_registered():
    names = pdfmetrics.getRegisteredFontNames()
    assert FONT_REGULAR in names
    assert FONT_BOLD in names
    assert FONT_ITALIC in names
    assert FONT_BOLD_ITALIC in names
