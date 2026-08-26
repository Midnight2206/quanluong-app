from app.render.carry_totals import (
    build_carry_row_values,
    find_amount_column_key,
    format_amount,
    parse_amount,
    sum_amount,
)
from app.template.metadata import ColumnMeta


def test_parse_amount_vietnamese_dots():
    assert parse_amount("1.234.567") == 1234567.0
    assert parse_amount("95.000") == 95000.0


def test_format_amount_uses_dot_thousands():
    assert format_amount(1234567) == "1.234.567"


def test_find_amount_column_prefers_thanh_tien():
    columns = [
        ColumnMeta("stt", "STT", 30, "center"),
        ColumnMeta("ten", "Tên", 100, "left"),
        ColumnMeta("thanh_tien", "Thành tiền", 80, "right"),
    ]
    assert find_amount_column_key(columns) == "thanh_tien"


def test_build_carry_row_values_puts_label_and_amount():
    columns = [
        ColumnMeta("stt", "STT", 30, "center"),
        ColumnMeta("ten", "Tên", 100, "left"),
        ColumnMeta("thanh_tien", "Thành tiền", 80, "right"),
    ]
    values = build_carry_row_values(
        columns,
        label="Cộng chuyển trang sau",
        amount=150000,
        amount_key="thanh_tien",
    )
    assert values == {
        "stt": "",
        "ten": "Cộng chuyển trang sau",
        "thanh_tien": "150.000",
    }


def test_sum_amount_page_rows():
    rows = [{"thanh_tien": "10.000"}, {"thanh_tien": "20.000"}]
    assert sum_amount(rows, "thanh_tien") == 30000.0
