from __future__ import annotations

from openpyxl.utils import get_column_letter

DEFAULT_ROW_HEIGHT_PT = 15.0


def col_width_to_pt(width_char: float | None) -> float:
    if width_char is None:
        width_char = 0.0
    return max(10.0, width_char * 7.0)


def _column_width_char(sheet, col: int) -> float | None:
    dim = sheet.column_dimensions.get(get_column_letter(col))
    if dim is None:
        return None
    return dim.width


def merged_range_width_pt(sheet, min_col: int, max_col: int) -> float:
    return sum(
        col_width_to_pt(_column_width_char(sheet, col))
        for col in range(min_col, max_col + 1)
    )


def _row_height_pt(sheet, row: int) -> float:
    dim = sheet.row_dimensions.get(row)
    if dim is not None and dim.height is not None:
        return float(dim.height)
    return DEFAULT_ROW_HEIGHT_PT


def cell_top_left_pt(
    sheet,
    row: int,
    col: int,
    *,
    page_height: float,
    margin_top: float,
) -> tuple[float, float]:
    x = sum(
        col_width_to_pt(_column_width_char(sheet, c))
        for c in range(1, col)
    )
    y_from_top = margin_top + sum(
        _row_height_pt(sheet, r) for r in range(1, row)
    )
    y = page_height - y_from_top
    return x, y


def signature_block_height_pt(signature_row_y: float, margin_bottom: float) -> float:
    return signature_row_y - margin_bottom
