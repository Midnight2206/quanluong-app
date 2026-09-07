from __future__ import annotations

from app.template.metadata import FieldMeta, PageMeta, StaticCellMeta, TableMeta, TemplateMetadata
from app.template.page_size import page_dimensions

from .errors import TemplateValidationError


def validate_table_fits_page(page: PageMeta, table: TableMeta) -> None:
    page_width, _ = page_dimensions(page)
    usable_width = page_width - page.margin_left - page.margin_right
    total_columns_width = sum(column.width_pt for column in table.columns)
    if total_columns_width > usable_width + 0.5:
        raise TemplateValidationError(
            f"Tổng độ rộng cột bảng ({total_columns_width:.1f}pt) vượt vùng in khả dụng "
            f"({usable_width:.1f}pt). Kiểm tra lại độ rộng cột trong TABLE_HEADER."
        )


def validate_fields_within_margins(page: PageMeta, fields: list[FieldMeta]) -> None:
    page_width, page_height = page_dimensions(page)
    min_x = page.margin_left
    max_x = page_width - page.margin_right
    min_y = page.margin_bottom
    max_y = page_height - page.margin_top
    for field in fields:
        if not (min_x <= field.x <= max_x and min_y <= field.y <= max_y):
            raise TemplateValidationError(
                f"Field {field.field_name} ({field.cell_ref}) nằm ngoài vùng in: "
                f"x={field.x:.1f} y={field.y:.1f} "
                f"(cho phép x[{min_x:.1f},{max_x:.1f}] y[{min_y:.1f},{max_y:.1f}])."
            )


def validate_static_cells_within_margins(
    page: PageMeta, static_cells: list[StaticCellMeta] | None
) -> None:
    if not static_cells:
        return
    page_width, page_height = page_dimensions(page)
    max_x = page_width - page.margin_right
    content_top = page_height - page.margin_top
    for cell in static_cells:
        if cell.x < page.margin_left - 0.5 or cell.x + cell.width_pt > max_x + 0.5:
            raise TemplateValidationError(
                f"Ô tĩnh hàng {cell.row} vượt biên ngang trang "
                f"(x={cell.x:.1f}, w={cell.width_pt:.1f})."
            )
        if cell.y < page.margin_bottom - 0.5 or cell.y + cell.height_pt > content_top + 0.5:
            raise TemplateValidationError(
                f"Ô tĩnh hàng {cell.row} vượt biên dọc trang "
                f"(y={cell.y:.1f}, h={cell.height_pt:.1f})."
            )


def last_page_usable_height(page: PageMeta, table: TableMeta) -> float:
    _, page_height = page_dimensions(page)
    base = (
        page_height
        - page.margin_top
        - page.margin_bottom
        - table.header_height_pt
        - table.min_rows_last_page * table.row_height_min
    )
    page1 = base - page.static_block_height_pt
    continuation = base - table.carry_height_pt
    return min(page1, continuation)


def validate_signature_fits_page(page: PageMeta, table: TableMeta) -> None:
    usable = last_page_usable_height(page, table)
    if table.signature_block_height_pt > usable:
        raise TemplateValidationError(
            f"Khối chữ ký ({table.signature_block_height_pt:.1f}pt) không đủ chỗ trong trang cuối "
            f"(khả dụng {usable:.1f}pt). Kiểm tra TABLE_SIGNATURE hoặc margin."
        )


def validate_template_layout(metadata: TemplateMetadata) -> None:
    validate_table_fits_page(metadata.page, metadata.table)
    validate_fields_within_margins(metadata.page, metadata.fields)
    validate_static_cells_within_margins(metadata.page, metadata.static_cells)
    validate_signature_fits_page(metadata.page, metadata.table)


__all__ = [
    "last_page_usable_height",
    "validate_fields_within_margins",
    "validate_signature_fits_page",
    "validate_static_cells_within_margins",
    "validate_table_fits_page",
    "validate_template_layout",
]
