from io import BytesIO

import pytest
from openpyxl import Workbook

from app.export import export_xlsx
from app.parse import parse_xlsx


def _xlsx_bytes(rows, sheet="Sheet1"):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_parse_simple():
    data = _xlsx_bytes([["Mã", "Tên"], ["A01", "Gạo"]])
    out = parse_xlsx(data)
    assert out["sheet"] == "Sheet1"
    assert out["sheets"] == ["Sheet1"]
    assert out["rows"][0] == {"r": 1, "c": ["Mã", "Tên"]}
    assert out["rows"][1]["c"][0] == "A01"


def test_export_round_trip():
    raw = export_xlsx("Data", [["A", "B"], [1, None]])
    out = parse_xlsx(raw, sheet="Data")
    assert out["sheet"] == "Data"
    assert out["rows"][0]["c"] == ["A", "B"]
    assert out["rows"][1]["c"][1] is None


def test_missing_sheet_raises():
    data = _xlsx_bytes([["x"]])
    with pytest.raises(ValueError, match="sheet"):
        parse_xlsx(data, sheet="Nope")


def test_export_empty_rows_raises():
    with pytest.raises(ValueError):
        export_xlsx("S", [])
