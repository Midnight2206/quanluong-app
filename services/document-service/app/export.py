from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook


def export_xlsx(sheet: str, rows: list[list]) -> bytes:
    if not rows:
        raise ValueError("Danh sách rows không được rỗng")

    if not isinstance(rows, list):
        raise ValueError("rows phải là mảng 2 chiều")

    for row in rows:
        if not isinstance(row, (list, tuple)):
            raise ValueError("rows phải là mảng 2 chiều")

    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    for row in rows:
        ws.append(list(row))

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
