from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from reportlab.lib import pagesizes
from reportlab.pdfgen import canvas

from app.pagination import PagePlan, plan_pages
from app.render.draw import draw_merged_cell, draw_table_row, draw_text
from app.render.fonts import FONT_BOLD, FONT_REGULAR
from app.template.demo_metadata import build_demo_metadata
from app.template.metadata import TemplateMetadata


@dataclass(frozen=True)
class _RenderColumn:
    key: str
    title: str
    width: float
    align: str


def _page_dimensions(metadata: TemplateMetadata) -> tuple[float, float]:
    size = getattr(pagesizes, metadata.page.page_size.upper(), pagesizes.A4)
    width, height = (round(dimension) for dimension in size)
    if metadata.page.orientation == "landscape":
        return height, width
    return width, height


def _render_columns(metadata: TemplateMetadata) -> list[_RenderColumn]:
    return [
        _RenderColumn(
            key=column.key,
            title=column.title,
            width=column.width_pt,
            align=column.align_h,
        )
        for column in metadata.table.columns
    ]


def _draw_static_fields(
    pdf: canvas.Canvas,
    *,
    metadata: TemplateMetadata,
    fields: dict[str, str],
    content_width: float,
) -> None:
    for field in metadata.fields:
        font = field.font or {}
        align = (field.align or {}).get("h", "left")
        value = f"{field.label_prefix}{fields.get(field.field_name, '')}"
        draw_text(
            pdf,
            x=field.x,
            y=field.y,
            text=value,
            font_name=font.get(
                "name", FONT_BOLD if font.get("bold", False) else FONT_REGULAR
            ),
            font_size=font.get("size", 10),
            align=align,
            max_width=content_width if align == "center" else None,
        )


def _draw_final_block(
    pdf: canvas.Canvas,
    *,
    y: float,
    table_left: float,
    table_width: float,
    carry_height: float,
    signature_block_height: float,
) -> None:
    total_height = carry_height
    signature_height = signature_block_height - total_height
    y -= total_height
    draw_merged_cell(
        pdf,
        x=table_left,
        y=y,
        width=table_width,
        height=total_height,
        text="Cộng",
        font_name=FONT_BOLD,
        font_size=10,
    )
    y -= signature_height
    half_width = table_width / 2
    for index, label in enumerate(("Người lập", "Thủ trưởng đơn vị")):
        draw_merged_cell(
            pdf,
            x=table_left + index * half_width,
            y=y,
            width=half_width,
            height=signature_height,
            text=label,
            font_name=FONT_BOLD,
            font_size=10,
            valign="top",
        )


def _draw_page(
    pdf: canvas.Canvas,
    *,
    page: PagePlan,
    rows: list[dict[str, str]],
    metadata: TemplateMetadata,
    columns: list[_RenderColumn],
    page_height: float,
) -> None:
    table = metadata.table
    table_left = metadata.page.margin_left
    table_width = sum(column.width for column in columns)
    if page.page_index == 0:
        y = (
            page_height
            - metadata.page.margin_top
            - metadata.page.static_block_height_pt
        )
    else:
        y = page_height - metadata.page.margin_top

    y -= table.header_height_pt
    draw_table_row(
        pdf,
        x=table_left,
        y=y,
        height=table.header_height_pt,
        columns=[column.title for column in columns],
        values={},
        col_defs=columns,
    )

    if page.has_carry_from_prev:
        y -= table.carry_height_pt
        draw_merged_cell(
            pdf,
            x=table_left,
            y=y,
            width=table_width,
            height=table.carry_height_pt,
            text="Mang từ trang trước",
            font_name=FONT_REGULAR,
            font_size=9,
        )

    for row_index, row_height in zip(page.row_indices, page.row_heights):
        y -= row_height
        draw_table_row(
            pdf,
            x=table_left,
            y=y,
            height=row_height,
            columns=None,
            values=rows[row_index],
            col_defs=columns,
        )

    if page.has_carry_to_next:
        y -= table.carry_height_pt
        draw_merged_cell(
            pdf,
            x=table_left,
            y=y,
            width=table_width,
            height=table.carry_height_pt,
            text="Cộng chuyển trang sau",
            font_name=FONT_REGULAR,
            font_size=9,
        )
    elif page.is_last:
        _draw_final_block(
            pdf,
            y=y,
            table_left=table_left,
            table_width=table_width,
            carry_height=table.carry_height_pt,
            signature_block_height=table.signature_block_height_pt,
        )


def render_pdf(
    *,
    metadata: TemplateMetadata,
    fields: dict[str, str],
    rows: list[dict[str, str]],
) -> bytes:
    if not isinstance(rows, list):
        raise TypeError("rows phải là list")
    if any(not isinstance(row, dict) for row in rows):
        raise ValueError("Mỗi phần tử rows phải là dict")

    page_width, page_height = _page_dimensions(metadata)
    table = metadata.table
    if rows:
        pages = plan_pages(
            n_rows=len(rows),
            page_content_height=(
                page_height
                - metadata.page.margin_top
                - metadata.page.margin_bottom
                - metadata.page.static_block_height_pt
            ),
            header_height=table.header_height_pt,
            carry_row_height=table.carry_height_pt,
            signature_block_height=table.signature_block_height_pt,
            row_height_min=table.row_height_min,
            row_height_max=table.row_height_max,
            min_rows_last_page=table.min_rows_last_page,
        ).pages
    else:
        pages = [
            PagePlan(
                page_index=0,
                row_indices=[],
                row_heights=[],
                has_carry_from_prev=False,
                has_carry_to_next=False,
                is_last=True,
            )
        ]

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(page_width, page_height))
    columns = _render_columns(metadata)
    content_width = page_width - metadata.page.margin_left - metadata.page.margin_right
    for page in pages:
        if page.page_index == 0:
            _draw_static_fields(
                pdf,
                metadata=metadata,
                fields=fields,
                content_width=content_width,
            )
        _draw_page(
            pdf,
            page=page,
            rows=rows,
            metadata=metadata,
            columns=columns,
            page_height=page_height,
        )
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def render_demo_pdf(
    *,
    fields: dict[str, str],
    rows: list[dict[str, str]],
) -> bytes:
    return render_pdf(metadata=build_demo_metadata(), fields=fields, rows=rows)


__all__ = ["render_demo_pdf", "render_pdf"]
