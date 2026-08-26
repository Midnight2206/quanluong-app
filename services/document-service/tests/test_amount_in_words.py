from app.render.amount_in_words import (
    AMOUNT_IN_WORDS_PREFIX,
    draw_amount_in_words_line,
    format_amount_in_words_line,
    measure_amount_in_words_height,
    resolve_document_amount,
    should_skip_scalar_field,
)
from app.render.fonts import FONT_BOLD
from app.render.text_wrap import line_height_for, wrap_text_to_width
from app.template.metadata import ColumnMeta


class _SpyCanvas:
    def __init__(self):
        self.calls = []

    def setFont(self, name, size):
        self.calls.append(("font", name, size))

    def drawString(self, x, y, text):
        self.calls.append(("text", text, x, y))


def test_resolve_prefers_tong_tien_field():
    columns = [ColumnMeta("thanh_tien", "Thành tiền", 80, "right")]
    rows = [{"thanh_tien": "1.000"}]
    assert resolve_document_amount({"tong_tien": "50.000"}, rows, columns) == 50000.0


def test_resolve_falls_back_to_row_sum_when_field_empty():
    columns = [ColumnMeta("thanh_tien", "Thành tiền", 80, "right")]
    rows = [{"thanh_tien": "10.000"}, {"thanh_tien": "5.000"}]
    assert resolve_document_amount({"tong_tien": "  "}, rows, columns) == 15000.0


def test_resolve_falls_back_to_row_sum_when_field_unparseable():
    columns = [ColumnMeta("thanh_tien", "Thành tiền", 80, "right")]
    rows = [{"thanh_tien": "10.000"}, {"thanh_tien": "5.000"}]
    assert resolve_document_amount({"tong_tien": "abc"}, rows, columns) == 15000.0


def test_resolve_falls_back_to_row_sum_when_field_negative():
    columns = [ColumnMeta("thanh_tien", "Thành tiền", 80, "right")]
    rows = [{"thanh_tien": "10.000"}, {"thanh_tien": "5.000"}]
    assert resolve_document_amount({"tong_tien": "-1000"}, rows, columns) == 15000.0


def test_resolve_accepts_explicit_zero_scalar():
    columns = [ColumnMeta("thanh_tien", "Thành tiền", 80, "right")]
    rows = [{"thanh_tien": "10.000"}]
    assert resolve_document_amount({"tong_tien": "0"}, rows, columns) == 0.0


def test_resolve_none_when_unparseable_and_no_amount_column():
    columns = [ColumnMeta("stt", "STT", 30, "center")]
    assert resolve_document_amount({"tong_tien": "abc"}, [], columns) is None


def test_resolve_none_without_field_or_amount_column():
    columns = [ColumnMeta("stt", "STT", 30, "center")]
    assert resolve_document_amount({}, [], columns) is None


def test_format_line_prefix():
    line = format_amount_in_words_line(100_000)
    assert line.startswith(AMOUNT_IN_WORDS_PREFIX)
    assert line == AMOUNT_IN_WORDS_PREFIX + "Một trăm nghìn đồng"


def test_skip_tong_tien_bang_chu():
    assert should_skip_scalar_field("tong_tien_bang_chu") is True
    assert should_skip_scalar_field("don_vi") is False


def test_measure_amount_in_words_height_zero_when_empty():
    assert measure_amount_in_words_height("", FONT_BOLD, 11.0, 200.0) == 0.0


def test_draw_amount_in_words_line_wraps_bold_and_returns_bottom_y():
    text = AMOUNT_IN_WORDS_PREFIX + "Một trăm nghìn đồng chẵn"
    font_size = 11.0
    max_width = 150.0
    expected_lines = wrap_text_to_width(text, FONT_BOLD, font_size, max_width)
    expected_y = 300.0 - 6.0 - line_height_for(font_size) * len(expected_lines)
    pdf = _SpyCanvas()

    actual_y = draw_amount_in_words_line(
        pdf,
        text=text,
        x=40.0,
        y_top=300.0,
        max_width=max_width,
        font_size=font_size,
    )

    assert actual_y == expected_y
    assert [call[1] for call in pdf.calls if call[0] == "text"] == expected_lines
    assert {
        (call[1], call[2]) for call in pdf.calls if call[0] == "font"
    } == {(FONT_BOLD, font_size)}
