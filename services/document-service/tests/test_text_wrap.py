from reportlab.pdfbase.pdfmetrics import stringWidth

from app.render.fonts import FONT_REGULAR
from app.render.text_wrap import (
    CELL_PADDING_PT,
    _greedy_wrap_paragraph,
    compute_row_height,
    line_height_for,
    measure_wrapped_height,
    wrap_text_to_width,
)
from app.template.metadata import ColumnMeta


def test_wrap_vietnamese_uses_real_font_width():
    text = "Nguyễn Văn A mua thịt bò tươi"
    max_width = 80.0
    lines = wrap_text_to_width(text, FONT_REGULAR, 10, max_width)
    assert len(lines) >= 2
    for line in lines:
        assert stringWidth(line, FONT_REGULAR, 10) <= max_width
    assert "Nguyễn" in lines[0]


def test_wrap_long_word_stays_on_one_line():
    word = "SiêuDàiKhôngCóKhoảngTrắng" * 3
    lines = wrap_text_to_width(word, FONT_REGULAR, 10, 40.0)
    assert lines == [word]


def test_wrap_balances_line_lengths_when_multi_line():
    """Không để dòng trên đầy / dòng dưới rất ngắn — cân độ dài các dòng."""
    text = "Thịt bò tươi loại một rất ngon dùng cho bữa trưa"
    max_width = 90.0
    greedy = _greedy_wrap_paragraph(text, FONT_REGULAR, 10, max_width)
    balanced = wrap_text_to_width(text, FONT_REGULAR, 10, max_width, balance=True)
    assert len(balanced) == len(greedy)
    assert len(balanced) >= 2
    for line in balanced:
        assert stringWidth(line, FONT_REGULAR, 10) <= max_width

    greedy_widths = [stringWidth(line, FONT_REGULAR, 10) for line in greedy]
    balanced_widths = [stringWidth(line, FONT_REGULAR, 10) for line in balanced]
    greedy_spread = max(greedy_widths) - min(greedy_widths)
    balanced_spread = max(balanced_widths) - min(balanced_widths)
    assert balanced_spread <= greedy_spread


def test_wrap_default_is_greedy_not_balanced():
    text = "Thịt bò tươi loại một rất ngon dùng cho bữa trưa"
    max_width = 90.0
    greedy = _greedy_wrap_paragraph(text, FONT_REGULAR, 10, max_width)
    assert wrap_text_to_width(text, FONT_REGULAR, 10, max_width) == greedy


def test_measure_wrapped_height_matches_line_count():
    line_height = line_height_for(10)
    text = "một hai ba bốn năm sáu bảy tám"
    lines = wrap_text_to_width(text, FONT_REGULAR, 10, 50.0)
    assert measure_wrapped_height(text, FONT_REGULAR, 10, 50.0, line_height) == (
        len(lines) * line_height
    )


def test_compute_row_height_uses_widest_column_wrap():
    columns = [
        ColumnMeta(key="stt", title="STT", width_pt=30, align_h="center"),
        ColumnMeta(key="ten", title="Tên", width_pt=60, align_h="left"),
    ]
    row = {"stt": "1", "ten": "Thịt bò tươi loại một rất ngon"}
    line_height = line_height_for(10)
    height = compute_row_height(row, columns, FONT_REGULAR, 10, line_height, 18)
    inner = 60 - 2 * CELL_PADDING_PT
    expected = max(
        measure_wrapped_height(row["ten"], FONT_REGULAR, 10, inner, line_height),
        18,
    )
    assert height == expected
    assert height >= 18
