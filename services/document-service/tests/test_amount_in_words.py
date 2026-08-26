from app.render.amount_in_words import (
    AMOUNT_IN_WORDS_PREFIX,
    format_amount_in_words_line,
    resolve_document_amount,
    should_skip_scalar_field,
)
from app.template.metadata import ColumnMeta


def test_resolve_prefers_tong_tien_field():
    columns = [ColumnMeta("thanh_tien", "Thành tiền", 80, "right")]
    rows = [{"thanh_tien": "1.000"}]
    assert resolve_document_amount({"tong_tien": "50.000"}, rows, columns) == 50000.0


def test_resolve_falls_back_to_row_sum_when_field_empty():
    columns = [ColumnMeta("thanh_tien", "Thành tiền", 80, "right")]
    rows = [{"thanh_tien": "10.000"}, {"thanh_tien": "5.000"}]
    assert resolve_document_amount({"tong_tien": "  "}, rows, columns) == 15000.0


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
