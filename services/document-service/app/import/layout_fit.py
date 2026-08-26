from __future__ import annotations

from app.template.metadata import FieldMeta, StaticCellMeta, TemplateMetadata


def fit_layout_to_page(metadata: TemplateMetadata, *, table_left_x: float) -> None:
    """Scale cột + ô tĩnh trong vùng bảng để khớp usable width A4 (margin L/R)."""
    page = metadata.page
    table = metadata.table
    from app.template.page_size import page_dimensions

    page_width, _ = page_dimensions(page)
    usable = page_width - page.margin_left - page.margin_right
    total = sum(column.width_pt for column in table.columns)
    if total <= 0:
        return
    scale = usable / total
    if abs(scale - 1.0) < 0.001:
        return

    table_right_x = table_left_x + total
    for column in table.columns:
        column.width_pt *= scale
    for field in metadata.fields:
        if table_left_x - 0.5 <= field.x <= table_right_x + 0.5:
            field.x = table_left_x + (field.x - table_left_x) * scale
            if field.width_pt is not None:
                field.width_pt *= scale
    if metadata.static_cells:
        for cell in metadata.static_cells:
            right = cell.x + cell.width_pt
            if right <= table_left_x + 0.5 or cell.x >= table_right_x - 0.5:
                continue
            cell.x = table_left_x + (cell.x - table_left_x) * scale
            cell.width_pt *= scale


__all__ = ["fit_layout_to_page"]
