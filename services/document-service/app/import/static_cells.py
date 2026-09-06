from __future__ import annotations

from openpyxl.cell.cell import MergedCell
from openpyxl.utils.cell import coordinate_from_string, column_index_from_string

from ..template.metadata import StaticCellMeta
from ..render.font_style import font_dict_from_cell
from .excel_coords import (
    DEFAULT_ROW_HEIGHT_PT,
    _row_height_pt,
    cell_top_left_pt,
    enclosing_merge_bounds,
    merged_range_height_pt,
    merged_range_width_pt,
)
from .field_named_ranges import is_field_named_range


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


def iter_static_merge_origins(
    sheet,
    *,
    min_col: int,
    max_col: int,
    min_row: int,
    max_row: int,
):
    visited: set[tuple[int, int]] = set()
    for row in range(min_row, max_row + 1):
        for col in range(min_col, max_col + 1):
            cell = sheet.cell(row, col)
            if isinstance(cell, MergedCell):
                continue
            merge_bounds = enclosing_merge_bounds(sheet, row, col)
            if merge_bounds is None:
                bounds = (col, row, col, row)
            else:
                bounds = merge_bounds
                if bounds[0] < min_col or bounds[2] > max_col:
                    bounds = (col, row, col, row)
            origin_key = (bounds[1], bounds[0])
            if origin_key in visited:
                continue
            visited.add(origin_key)
            yield (*bounds, cell)


def field_coords_from_workbook(
    workbook,
    *,
    resolve_defined_range,
    all_defined_names,
) -> set[tuple[int, int]]:
    coords: set[tuple[int, int]] = set()
    for defined_name, owner_sheet in all_defined_names(workbook):
        if not is_field_named_range(defined_name.name):
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
    header_min_col, header_min_row, header_max_col, header_max_row = header_bounds
    data_row = data_bounds[1]
    skip_coords = field_coords or set()
    static_cells: list[StaticCellMeta] = []

    for min_col, min_row, max_col, max_row, cell in iter_static_merge_origins(
        sheet,
        min_col=header_min_col,
        max_col=header_max_col,
        min_row=1,
        max_row=sheet.max_row,
    ):
        if min_row <= data_row <= max_row:
            continue
        if (min_row, min_col) in skip_coords:
            continue
        if header_min_row <= min_row <= header_max_row:
            layer = "header"
        elif min_row > data_row:
            layer = "signature"
        elif min_row < header_min_row:
            layer = "body"
        else:
            # Hàng giữa TABLE_HEADER và TABLE_DATA_ROW (tiêu đề phụ / khoảng trống).
            layer = "body"
        font, align, border = _style_dict(cell)
        value = _cell_value(cell)
        if not value and not _has_visible_border(border):
            continue
        x, y_top = cell_top_left_pt(
            sheet,
            min_row,
            min_col,
            page_height=page_height,
            margin_top=margin_top,
            margin_left=margin_left,
        )
        width = merged_range_width_pt(sheet, min_col, max_col)
        height = merged_range_height_pt(sheet, min_row, max_row)
        static_cells.append(
            StaticCellMeta(
                layer=layer,
                row=min_row,
                x=x,
                y=y_top - height,
                width_pt=width,
                height_pt=height,
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
    "iter_static_merge_origins",
    "static_block_height_pt",
    "DEFAULT_ROW_HEIGHT_PT",
]
