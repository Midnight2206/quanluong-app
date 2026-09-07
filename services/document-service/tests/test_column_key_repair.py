import importlib

from app.template.metadata import ColumnMeta, StaticCellMeta

column_key_repair = importlib.import_module("app.import.column_key_repair")
repair_weak_columns_from_static_headers = column_key_repair.repair_weak_columns_from_static_headers


def _cell(value, *, x, width, row=10, layer="header"):
    return StaticCellMeta(
        layer=layer,
        row=row,
        x=x,
        y=700,
        width_pt=width,
        height_pt=18,
        value=value,
    )


def test_repair_weak_columns_uses_vietnamese_static_headers():
    columns = [
        ColumnMeta(key="a", title="A", width_pt=40, align_h="center"),
        ColumnMeta(key="b", title="B", width_pt=120, align_h="left"),
        ColumnMeta(key="1", title="1", width_pt=50, align_h="right"),
        ColumnMeta(key="2", title="2", width_pt=50, align_h="right"),
    ]
    static_cells = [
        _cell("TT", x=0, width=40, row=10),
        _cell("Tên hàng", x=40, width=120, row=10),
        _cell("Số lượng", x=160, width=100, row=10),
        _cell("Yêu cầu", x=160, width=50, row=11),
        _cell("Thực xuất", x=210, width=50, row=11),
        _cell("A", x=0, width=40, row=12),
        _cell("B", x=40, width=120, row=12),
        _cell("1", x=160, width=50, row=12),
        _cell("2", x=210, width=50, row=12),
    ]

    repaired = repair_weak_columns_from_static_headers(columns, static_cells)
    assert [column.key for column in repaired] == [
        "tt",
        "ten_hang",
        "yeu_cau",
        "thuc_xuat",
    ]
    assert repaired[0].title == "TT"
    assert repaired[2].title == "Yêu cầu"


def test_repair_skips_when_keys_already_semantic():
    columns = [ColumnMeta(key="stt", title="STT", width_pt=40, align_h="center")]
    static_cells = [_cell("A", x=0, width=40, row=12)]
    assert repair_weak_columns_from_static_headers(columns, static_cells) is columns
