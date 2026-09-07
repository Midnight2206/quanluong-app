from __future__ import annotations

from openpyxl.utils import get_column_letter

DEFAULT_ROW_HEIGHT_PT = 15.0

# Maximum Digit Width (MDW) — số pixel chiều rộng ký tự '0' trong font mặc định tại 96 DPI.
# Excel dùng MDW để quy đổi col_width (character units) sang pixel.
# Tinos 11pt (thay thế metric cho Times New Roman 11pt): MDW ≈ 6 px.
# ponytail: hằng số này cần xác nhận lại nếu template dùng font/size mặc định workbook khác
# (VD Calibri 11 → MDW=7). Upgrade path: đọc font default từ wb.loaded_theme hoặc style "Normal".
MDW_DEFAULT = 6  # Tinos 11pt / Times New Roman 11pt @ 96 DPI


def col_width_to_pt(width_char: float | None, mdw: int = MDW_DEFAULT) -> float:
    """
    Quy đổi Excel column width (character units) sang point.

    Công thức chính thức Excel (OOXML spec §18.3.1.13):
        width_px = int(((256 * width_char + int(128 / mdw)) / 256) * mdw)
        width_pt = width_px * 0.75   # 96 DPI → 72 DPI (1pt = 96/72 px)

    Minimum 10pt để tránh cột vô hình.
    """
    if width_char is None or width_char <= 0:
        width_char = 0.0
    width_px = int(((256 * width_char + int(128 / mdw)) / 256) * mdw)
    return max(10.0, width_px * 0.75)


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


def merged_range_height_pt(sheet, min_row: int, max_row: int) -> float:
    return sum(_row_height_pt(sheet, row) for row in range(min_row, max_row + 1))


def enclosing_merge_bounds(
    sheet, row: int, col: int
) -> tuple[int, int, int, int] | None:
    for cell_range in sheet.merged_cells.ranges:
        if (
            cell_range.min_row <= row <= cell_range.max_row
            and cell_range.min_col <= col <= cell_range.max_col
        ):
            return (
                cell_range.min_col,
                cell_range.min_row,
                cell_range.max_col,
                cell_range.max_row,
            )
    return None


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
    margin_left: float,
) -> tuple[float, float]:
    x = margin_left + sum(
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
