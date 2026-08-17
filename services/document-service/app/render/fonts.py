from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_REGULAR = "DejaVuSans"
FONT_BOLD = "DejaVuSans-Bold"

FONTS_DIR = Path(__file__).resolve().parents[2] / "fonts"
_REGULAR_PATH = FONTS_DIR / f"{FONT_REGULAR}.ttf"
_BOLD_PATH = FONTS_DIR / f"{FONT_BOLD}.ttf"


def _register_fonts() -> None:
    if not _REGULAR_PATH.is_file():
        raise RuntimeError("Không tìm thấy font DejaVuSans")
    if not _BOLD_PATH.is_file():
        raise RuntimeError("Không tìm thấy font DejaVuSans")

    pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(_REGULAR_PATH)))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(_BOLD_PATH)))
    pdfmetrics.registerFontFamily(
        FONT_REGULAR,
        normal=FONT_REGULAR,
        bold=FONT_BOLD,
    )


_register_fonts()
