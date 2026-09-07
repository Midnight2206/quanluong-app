from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Tinos — font thay thế Times New Roman, metric tương thích, license Apache 2.0 (SIL OFL).
# Nguồn: https://github.com/google/fonts/tree/main/apache/tinos
FONT_REGULAR = "TimesNewRoman"
FONT_BOLD = "TimesNewRoman-Bold"
FONT_ITALIC = "TimesNewRoman-Italic"
FONT_BOLD_ITALIC = "TimesNewRoman-BoldItalic"

FONTS_DIR = Path(__file__).resolve().parents[2] / "fonts"
_REGULAR_PATH = FONTS_DIR / "Tinos-Regular.ttf"
_BOLD_PATH = FONTS_DIR / "Tinos-Bold.ttf"
_ITALIC_PATH = FONTS_DIR / "Tinos-Italic.ttf"
_BOLD_ITALIC_PATH = FONTS_DIR / "Tinos-BoldItalic.ttf"


def _register_fonts() -> None:
    if not _REGULAR_PATH.is_file():
        raise RuntimeError("Không tìm thấy font Tinos-Regular.ttf")
    if not _BOLD_PATH.is_file():
        raise RuntimeError("Không tìm thấy font Tinos-Bold.ttf")
    if not _ITALIC_PATH.is_file():
        raise RuntimeError("Không tìm thấy font Tinos-Italic.ttf")
    if not _BOLD_ITALIC_PATH.is_file():
        raise RuntimeError("Không tìm thấy font Tinos-BoldItalic.ttf")

    pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(_REGULAR_PATH)))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(_BOLD_PATH)))
    pdfmetrics.registerFont(TTFont(FONT_ITALIC, str(_ITALIC_PATH)))
    pdfmetrics.registerFont(TTFont(FONT_BOLD_ITALIC, str(_BOLD_ITALIC_PATH)))
    pdfmetrics.registerFontFamily(
        FONT_REGULAR,
        normal=FONT_REGULAR,
        bold=FONT_BOLD,
        italic=FONT_ITALIC,
        boldItalic=FONT_BOLD_ITALIC,
    )


_register_fonts()
