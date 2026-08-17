from __future__ import annotations

from io import BytesIO

from reportlab.pdfgen import canvas

from app.pagination import PagePlan, plan_pages
from app.render.demo_template import (
    CARRY_HEIGHT,
    CONTENT_WIDTH,
    DEMO_COLUMNS,
    DEMO_FIELDS,
    HEADER_HEIGHT,
    MARGIN_TOP,
    MIN_ROWS_LAST_PAGE,
    PAGE_HEIGHT,
    PAGE_WIDTH,
    ROW_HEIGHT_MAX,
    ROW_HEIGHT_MIN,
    SIGNATURE_HEIGHT,
    TABLE_LEFT,
    content_height_page1,
    table_top_y_page1,
)
from app.render.draw import draw_merged_cell, draw_table_row, draw_text
from app.render.fonts import FONT_BOLD, FONT_REGULAR

_TABLE_WIDTH = sum(column.width for column in DEMO_COLUMNS)


def _draw_static_fields(pdf: canvas.Canvas, fields: dict[str, str]) -> None:
    for field in DEMO_FIELDS:
        value = f"{field.prefix}{fields.get(field.field_name, '')}"
        max_width = CONTENT_WIDTH if field.field_name == "tieu_de" else None
        draw_text(
            pdf,
            x=field.x,
            y=field.y,
            text=value,
            font_name=FONT_BOLD if field.bold else FONT_REGULAR,
            font_size=field.font_size,
            align=field.align,
            max_width=max_width,
        )


def _draw_final_block(pdf: canvas.Canvas, y: float) -> None:
    total_height = CARRY_HEIGHT
    signature_height = SIGNATURE_HEIGHT - total_height
    y -= total_height
    draw_merged_cell(
        pdf,
        x=TABLE_LEFT,
        y=y,
        width=_TABLE_WIDTH,
        height=total_height,
        text="Cộng",
        font_name=FONT_BOLD,
        font_size=10,
    )
    y -= signature_height
    half_width = _TABLE_WIDTH / 2
    for index, label in enumerate(("Người lập", "Thủ trưởng đơn vị")):
        draw_merged_cell(
            pdf,
            x=TABLE_LEFT + index * half_width,
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
) -> None:
    if page.page_index == 0:
        y = table_top_y_page1()
    else:
        y = PAGE_HEIGHT - MARGIN_TOP

    y -= HEADER_HEIGHT
    draw_table_row(
        pdf,
        x=TABLE_LEFT,
        y=y,
        height=HEADER_HEIGHT,
        columns=[column.title for column in DEMO_COLUMNS],
        values={},
        col_defs=DEMO_COLUMNS,
    )

    if page.has_carry_from_prev:
        y -= CARRY_HEIGHT
        draw_merged_cell(
            pdf,
            x=TABLE_LEFT,
            y=y,
            width=_TABLE_WIDTH,
            height=CARRY_HEIGHT,
            text="Mang từ trang trước",
            font_name=FONT_REGULAR,
            font_size=9,
        )

    for row_index, row_height in zip(page.row_indices, page.row_heights):
        y -= row_height
        draw_table_row(
            pdf,
            x=TABLE_LEFT,
            y=y,
            height=row_height,
            columns=None,
            values=rows[row_index],
            col_defs=DEMO_COLUMNS,
        )

    if page.has_carry_to_next:
        y -= CARRY_HEIGHT
        draw_merged_cell(
            pdf,
            x=TABLE_LEFT,
            y=y,
            width=_TABLE_WIDTH,
            height=CARRY_HEIGHT,
            text="Cộng chuyển trang sau",
            font_name=FONT_REGULAR,
            font_size=9,
        )
    elif page.is_last:
        _draw_final_block(pdf, y)


def render_demo_pdf(
    *,
    fields: dict[str, str],
    rows: list[dict[str, str]],
) -> bytes:
    if not isinstance(rows, list):
        raise TypeError("rows phải là list")
    if any(not isinstance(row, dict) for row in rows):
        raise ValueError("Mỗi phần tử rows phải là dict")

    if rows:
        pages = plan_pages(
            n_rows=len(rows),
            page_content_height=content_height_page1(),
            header_height=HEADER_HEIGHT,
            carry_row_height=CARRY_HEIGHT,
            signature_block_height=SIGNATURE_HEIGHT,
            row_height_min=ROW_HEIGHT_MIN,
            row_height_max=ROW_HEIGHT_MAX,
            min_rows_last_page=MIN_ROWS_LAST_PAGE,
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
    pdf = canvas.Canvas(buffer, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    for page in pages:
        if page.page_index == 0:
            _draw_static_fields(pdf, fields)
        _draw_page(pdf, page=page, rows=rows)
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


__all__ = ["render_demo_pdf"]
