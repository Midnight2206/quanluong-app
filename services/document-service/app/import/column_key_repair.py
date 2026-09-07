from __future__ import annotations

from ..template.metadata import ColumnMeta, StaticCellMeta
from .header_titles import (
    is_weak_header_title,
    slug_header_title,
    unique_column_key,
)


def _column_x_ranges(
    columns: list[ColumnMeta], start_x: float
) -> list[tuple[float, float]]:
    ranges: list[tuple[float, float]] = []
    x = float(start_x)
    for column in columns:
        width = float(column.width_pt or 0)
        ranges.append((x, x + width))
        x += width
    return ranges


def _overlap(a0: float, a1: float, b0: float, b1: float) -> float:
    return min(a1, b1) - max(a0, b0)


def _covers_multiple_columns(cell: StaticCellMeta, ranges: list[tuple[float, float]]) -> bool:
    """True for parent headers like «Số lượng» spanning Yêu cầu + Thực xuất."""
    hits = 0
    for x0, x1 in ranges:
        col_w = max(x1 - x0, 1.0)
        if _overlap(x0, x1, cell.x, cell.x + cell.width_pt) > col_w * 0.5:
            hits += 1
            if hits > 1:
                return True
    return False


def repair_weak_columns_from_static_headers(
    columns: list[ColumnMeta],
    static_cells: list[StaticCellMeta],
) -> list[ColumnMeta]:
    """Rebuild key/title when importer captured letter/number code row (A,B,1,2…)."""
    if not columns or not all(is_weak_header_title(column.key) for column in columns):
        return columns

    header_cells = [
        cell
        for cell in static_cells
        if cell.layer == "header" and not is_weak_header_title(cell.value)
    ]
    if not header_cells:
        return columns

    code_cells = [
        cell
        for cell in static_cells
        if cell.layer == "header" and is_weak_header_title(cell.value)
    ]
    start_x = min((cell.x for cell in code_cells), default=min(cell.x for cell in header_cells))
    ranges = _column_x_ranges(columns, start_x)
    used_keys: dict[str, int] = {}
    repaired: list[ColumnMeta] = []

    for column, (x0, x1) in zip(columns, ranges):
        col_w = max(x1 - x0, 1.0)
        scored = []
        for cell in header_cells:
            overlap = _overlap(x0, x1, cell.x, cell.x + cell.width_pt)
            if overlap <= 0:
                continue
            if _covers_multiple_columns(cell, ranges):
                continue
            center = cell.x + cell.width_pt / 2.0
            center_in = 1 if x0 <= center <= x1 else 0
            scored.append((center_in, overlap / col_w, cell.row, -cell.width_pt, cell))

        if not scored:
            for cell in header_cells:
                overlap = _overlap(x0, x1, cell.x, cell.x + cell.width_pt)
                if overlap <= 0:
                    continue
                scored.append((0, overlap / col_w, cell.row, -cell.width_pt, cell))

        if not scored:
            repaired.append(column)
            continue

        best = max(scored, key=lambda item: item[:4])[4]
        title = str(best.value or "").strip() or column.title
        base_key = slug_header_title(title) or column.key
        key = unique_column_key(base_key, used_keys)
        repaired.append(
            ColumnMeta(
                key=key,
                title=title,
                width_pt=column.width_pt,
                align_h=column.align_h,
            )
        )
    return repaired


__all__ = ["repair_weak_columns_from_static_headers"]
