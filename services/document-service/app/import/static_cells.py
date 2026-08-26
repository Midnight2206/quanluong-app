from __future__ import annotations

from openpyxl.cell.cell import MergedCell
from openpyxl.utils.cell import coordinate_from_string, column_index_from_string

from ..template.metadata import StaticCellMeta
from ..render.font_style import font_dict_from_cell
from .excel_coords import (
    DEFAULT_ROW_HEIGHT_PT,
    _row_height_pt,
    cell_top_left_pt,
    merged_range_width_pt,
)


def _cell_value(cell) -> str:
    if cell.value is None:
        return ""
    return str(cell.value).strip()


def _has_visible_border(border: dict | None) -> bool:
    if not border:
        return False
    return any(border.get(side) for side in ("left", "right", "top", "bottom"))


def _style_dict(cell):
    font = font_dict_from_cell(cell)
    align = {
        "h": cell.alignment.horizontal or "left",
        "v": cell.alignment.vertical,
        "wrap_text": bool(cell.alignment.wrap_text),
    }
    border = {
        side: getattr(cell.border, side).style
        for side in ("left", "right", "top", "bottom")
    }
    return font, align, border


def _row_groups(sheet, row: int, min_col: int, max_col: int):
    col = min_col
    while col <= max_col:
        merged = next(
            (
                cell_range
                for cell_range in sheet.merged_cells.ranges
                if cell_range.min_row <= row <= cell_range.max_row
                and cell_range.min_col <= col <= cell_range.max_col
            ),
            None,
        )
        if merged is None:
            yield col, col
            col += 1
            continue
        if merged.min_col < min_col or merged.max_col > max_col:
            yield col, col
            col += 1
            continue
        yield merged.min_col, merged.max_col
        col = merged.max_col + 1


def field_coords_from_workbook(
    workbook,
    *,
    resolve_defined_range,
    all_defined_names,
) -> set[tuple[int, int]]:
    coords: set[tuple[int, int]] = set()
    for defined_name, owner_sheet in all_defined_names(workbook):
        if not defined_name.name.startswith("FIELD_"):
            continue
        _, _, bounds = resolve_defined_range(workbook, defined_name, owner_sheet)
        min_col, min_row, max_col, max_row = bounds
        for row in range(min_row, max_row + 1):
            for col in range(min_col, max_col + 1):
                coords.add((row, col))
    return coords


def field_coords_from_cell_refs(cell_refs: list[str]) -> set[tuple[int, int]]:
    coords: set[tuple[int, int]] = set()
    for cell_ref in cell_refs:
        column, row = coordinate_from_string(cell_ref)
        coords.add((row, column_index_from_string(column)))
    return coords


def collect_static_cells(
    workbook,
    *,
    sheet_name: str,
    header_bounds: tuple[int, int, int, int],
    data_bounds: tuple[int, int, int, int],
    page_height: float,
    margin_top: float,
    margin_left: float,
    field_coords: set[tuple[int, int]] | None = None,
) -> list[StaticCellMeta]:
    sheet = workbook[sheet_name]
    header_min_col, header_row, header_max_col, _ = header_bounds
    data_row = data_bounds[1]
    skip_coords = field_coords or set()
    static_cells: list[StaticCellMeta] = []

    for row in range(1, sheet.max_row + 1):
        if row == data_row:
            continue
        if row == header_row:
            layer = "header"
        elif row > data_row:
            layer = "signature"
        elif row < header_row:
            layer = "body"
        else:
            # Hàng giữa TABLE_HEADER và TABLE_DATA_ROW (tiêu đề phụ / khoảng trống).
            layer = "body"

        row_height = _row_height_pt(sheet, row)
        for min_col, max_col in _row_groups(sheet, row, header_min_col, header_max_col):
            if (row, min_col) in skip_coords:
                continue
            cell = sheet.cell(row, min_col)
            if isinstance(cell, MergedCell):
                continue
            font, align, border = _style_dict(cell)
            value = _cell_value(cell)
            if not value and not _has_visible_border(border):
                continue
            x, y_top = cell_top_left_pt(
                sheet,
                row,
                min_col,
                page_height=page_height,
                margin_top=margin_top,
                margin_left=margin_left,
            )
            width = merged_range_width_pt(sheet, min_col, max_col)
            static_cells.append(
                StaticCellMeta(
                    layer=layer,
                    row=row,
                    x=x,
                    y=y_top - row_height,
                    width_pt=width,
                    height_pt=row_height,
                    value=value,
                    font=font,
                    align=align,
                    border=border,
                )
            )
    return static_cells


def static_block_height_pt(sheet, header_row: int) -> float:
    if header_row <= 1:
        return 0.0
    return sum(_row_height_pt(sheet, row) for row in range(1, header_row))


__all__ = [
    "collect_static_cells",
    "field_coords_from_cell_refs",
    "field_coords_from_workbook",
    "static_block_height_pt",
    "DEFAULT_ROW_HEIGHT_PT",
]
