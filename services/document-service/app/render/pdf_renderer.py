from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from reportlab.pdfgen import canvas

from app.pagination import PagePlan, apply_content_row_heights, plan_pages
from app.render.amount_in_words import (
    draw_amount_in_words_line,
    format_amount_in_words_line,
    measure_amount_in_words_height,
    resolve_document_amount,
    should_skip_scalar_field,
)
from app.render.carry_totals import (
    build_carry_row_values,
    find_amount_column_key,
    sum_amount,
)
from app.render.draw import (
    draw_static_cell,
    draw_table_header_frame,
    draw_table_row,
    draw_text,
    has_visible_border,
)
from app.render.font_style import render_font
from app.render.fonts import FONT_BOLD, FONT_BOLD_ITALIC, FONT_ITALIC, FONT_REGULAR
from app.render.signature_block import (
    compute_signature_block_anchor_y,
    default_signature_block,
    draw_signature_block,
    signature_block_extra_height,
)
from app.render.text_wrap import compute_row_height, line_height_for
from app.template.demo_metadata import build_demo_metadata
from app.template.metadata import SignatureBlockConfig, StaticCellMeta, TemplateMetadata
from app.template.page_size import page_dimensions


@dataclass(frozen=True)
class _RenderColumn:
    key: str
    title: str
    width: float
    align: str


def _style_font(style: dict | None, key: str) -> tuple[str, float]:
    payload = (style or {}).get(key) or (style or {}).get("font") or {}
    return render_font(payload)


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


def _cells_by_layer(metadata: TemplateMetadata) -> dict[str, list[StaticCellMeta]]:
    cells = metadata.static_cells or []
    return {
        "body": [cell for cell in cells if cell.layer == "body"],
        "header": [cell for cell in cells if cell.layer == "header"],
        "signature": [cell for cell in cells if cell.layer == "signature"],
    }


def _draw_static_cells(
    pdf: canvas.Canvas,
    cells: list[StaticCellMeta],
    *,
    y_offset: float = 0,
) -> None:
    for cell in cells:
        draw_static_cell(
            pdf,
            x=cell.x,
            y=cell.y + y_offset,
            width=cell.width_pt,
            height=cell.height_pt,
            value=cell.value,
            font=cell.font,
            align=cell.align,
            border=cell.border,
        )


def _layer_anchor_y(cells: list[StaticCellMeta]) -> float:
    return min(cell.y for cell in cells)


def _table_start_y(page_index: int, page_height: float, metadata: TemplateMetadata) -> float:
    y = page_height - metadata.page.margin_top
    if page_index == 0:
        y -= metadata.page.static_block_height_pt
    return y


def _table_left(metadata: TemplateMetadata, columns: list[_RenderColumn]) -> float:
    header_cells = (metadata.static_cells or [])
    header_x = [cell.x for cell in header_cells if cell.layer == "header"]
    if header_x:
        return min(header_x)
    return metadata.page.margin_left


def _signature_config(metadata: TemplateMetadata) -> SignatureBlockConfig:
    return metadata.signature_block or default_signature_block()


def _planner_signature_height(metadata: TemplateMetadata, body_font_size: float) -> float:
    return metadata.table.signature_block_height_pt + signature_block_extra_height(
        _signature_config(metadata),
        body_font_size=body_font_size,
    )


def _table_border(style: dict | None, key: str) -> dict | None:
    """None style → khung demo; có style → dict Excel (có thể không có cạnh nào)."""
    if style is None:
        return None
    return style.get(key) or {}


def _should_draw_header_frame(
    style: dict | None,
    header_cells: list[StaticCellMeta],
) -> bool:
    if any(has_visible_border(cell.border) for cell in header_cells):
        return True
    if style is None:
        return True
    return has_visible_border(style.get("header_border"))


def _draw_table_header(
    pdf: canvas.Canvas,
    *,
    y: float,
    metadata: TemplateMetadata,
    columns: list[_RenderColumn],
    header_cells: list[StaticCellMeta],
    table_left: float,
    table_width: float,
) -> float:
    header_top = y
    table = metadata.table
    style = metadata.table.row_style
    style_dict = style or {}
    header_font_name, header_font_size = _style_font(style_dict, "header_font")
    header_border = _table_border(style, "header_border")

    if header_cells:
        header_anchor = _layer_anchor_y(header_cells)
        header_bottom = y - table.header_height_pt
        _draw_static_cells(
            pdf,
            header_cells,
            y_offset=header_bottom - header_anchor,
        )
        y = header_bottom
    else:
        y -= table.header_height_pt
        draw_table_row(
            pdf,
            x=table_left,
            y=y,
            height=table.header_height_pt,
            columns=[column.title for column in columns],
            values={},
            col_defs=columns,
            font_name=header_font_name,
            font_size=header_font_size,
            valign="middle",
            border=header_border,
        )

    if _should_draw_header_frame(style, header_cells):
        draw_table_header_frame(
            pdf,
            x=table_left,
            y_top=header_top,
            width=table_width,
            height=table.header_height_pt,
        )
    return y


def _draw_static_fields(
    pdf: canvas.Canvas,
    *,
    metadata: TemplateMetadata,
    fields: dict[str, str],
    content_width: float,
) -> None:
    for field in metadata.fields:
        if should_skip_scalar_field(field.field_name):
            continue
        value = f"{field.label_prefix}{fields.get(field.field_name, '')}"
        width = field.width_pt
        height = field.height_pt
        if width and height and width > 0 and height > 0:
            # Căn trong đúng ô Excel (không dùng full content_width).
            draw_static_cell(
                pdf,
                x=field.x,
                y=field.y - height,
                width=width,
                height=height,
                value=value,
                font=field.font,
                align=field.align,
                border=field.border,
            )
            continue
        font_name, font_size = render_font(field.font)
        align = (field.align or {}).get("h", "left")
        draw_text(
            pdf,
            x=field.x,
            y=field.y,
            text=value,
            font_name=font_name,
            font_size=font_size,
            align=align,
            max_width=content_width if align == "center" else None,
        )


def _carry_row_height(table, page: PagePlan) -> float:
    """Cùng nhịp chiều cao với dòng dữ liệu trên trang — chữ «Cộng» căn giữa row."""
    if page.row_heights:
        data_h = max(page.row_heights)
    else:
        data_h = table.row_height_min
    return max(float(table.carry_height_pt), float(data_h))


def _draw_carry_row(
    pdf: canvas.Canvas,
    *,
    y: float,
    table_left: float,
    height: float,
    columns: list[_RenderColumn],
    label: str,
    amount: float,
    amount_key: str | None,
    font_size: float,
    border: dict | None,
) -> float:
    y -= height
    values = build_carry_row_values(
        columns,
        label=label,
        amount=amount,
        amount_key=amount_key,
    )
    draw_table_row(
        pdf,
        x=table_left,
        y=y,
        height=height,
        columns=None,
        values=values,
        col_defs=columns,
        font_name=FONT_BOLD_ITALIC,
        font_size=font_size,
        valign="middle",
        border=border,
    )
    return y


def _draw_page(
    pdf: canvas.Canvas,
    *,
    page: PagePlan,
    rows: list[dict[str, str]],
    metadata: TemplateMetadata,
    columns: list[_RenderColumn],
    page_height: float,
    static_layers: dict[str, list[StaticCellMeta]],
    row_font_name: str,
    row_font_size: float,
    signatures: dict[str, str],
    signature_dates: dict[str, str],
    amount_in_words_text: str,
) -> None:
    table = metadata.table
    table_left = _table_left(metadata, columns)
    table_width = sum(column.width for column in columns)
    header_cells = static_layers["header"]
    amount_key = find_amount_column_key(columns)
    row_border = _table_border(table.row_style, "border")
    page_rows = [rows[index] for index in page.row_indices]
    prev_rows = rows[: page.row_indices[0]] if page.row_indices else rows[:0]
    y = _table_start_y(page.page_index, page_height, metadata)
    y = _draw_table_header(
        pdf,
        y=y,
        metadata=metadata,
        columns=columns,
        header_cells=header_cells,
        table_left=table_left,
        table_width=table_width,
    )

    if page.has_carry_from_prev:
        y = _draw_carry_row(
            pdf,
            y=y,
            table_left=table_left,
            height=_carry_row_height(table, page),
            columns=columns,
            label="Mang sang",
            amount=sum_amount(prev_rows, amount_key),
            amount_key=amount_key,
            font_size=row_font_size,
            border=row_border,
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
            font_name=row_font_name,
            font_size=row_font_size,
            valign="middle",
            border=row_border,
        )

    carry_h = _carry_row_height(table, page)
    if page.has_carry_to_next:
        # Tổng lũy kế hết trang này = "Mang sang" của trang sau.
        y = _draw_carry_row(
            pdf,
            y=y,
            table_left=table_left,
            height=carry_h,
            columns=columns,
            label="Cộng mang sang",
            amount=sum_amount(prev_rows, amount_key) + sum_amount(page_rows, amount_key),
            amount_key=amount_key,
            font_size=row_font_size,
            border=row_border,
        )
    elif page.is_last:
        y = _draw_carry_row(
            pdf,
            y=y,
            table_left=table_left,
            height=carry_h,
            columns=columns,
            label="Cộng",
            amount=sum_amount(rows, amount_key),
            amount_key=amount_key,
            font_size=row_font_size,
            border=row_border,
        )
        y = draw_amount_in_words_line(
            pdf,
            text=amount_in_words_text,
            x=table_left,
            y_top=y,
            max_width=table_width,
            font_size=row_font_size,
        )
        if static_layers["signature"]:
            _draw_static_cells(pdf, static_layers["signature"])
        extra_fields = [
            field
            for field in metadata.fields
            if field.below_table and not should_skip_scalar_field(field.field_name)
        ]
        anchor_y = compute_signature_block_anchor_y(y, extra_fields)
        draw_signature_block(
            pdf,
            config=_signature_config(metadata),
            signatures=signatures,
            signature_dates=signature_dates,
            anchor_y=anchor_y,
            page=metadata.page,
            font_name=FONT_REGULAR,
            font_name_bold=FONT_BOLD,
            font_name_italic=FONT_ITALIC,
            body_font_size=row_font_size,
        )


def render_pdf(
    *,
    metadata: TemplateMetadata,
    fields: dict[str, str],
    rows: list[dict[str, str]],
    signatures: dict[str, str] | None = None,
    signature_dates: dict[str, str] | None = None,
) -> bytes:
    if not isinstance(rows, list):
        raise TypeError("rows phải là list")
    if any(not isinstance(row, dict) for row in rows):
        raise ValueError("Mỗi phần tử rows phải là dict")

    page_width, page_height = page_dimensions(metadata.page)
    table = metadata.table
    columns = _render_columns(metadata)
    table_width = sum(column.width for column in columns)
    row_font_name, row_font_size = render_font((table.row_style or {}).get("font"))
    line_height = line_height_for(row_font_size)
    amount = resolve_document_amount(fields, rows, metadata.table.columns)
    amount_in_words_text = format_amount_in_words_line(amount) if amount is not None else ""
    amount_h = (
        measure_amount_in_words_height(
            amount_in_words_text,
            FONT_BOLD,
            row_font_size,
            table_width,
        )
        + 6.0
        if amount_in_words_text
        else 0.0
    )
    needed_heights = [
        compute_row_height(
            row,
            table.columns,
            row_font_name,
            row_font_size,
            line_height,
            table.row_height_min,
        )
        for row in rows
    ]
    natural_height = max(needed_heights, default=table.row_height_min)
    sig_height = _planner_signature_height(metadata, row_font_size) + amount_h
    page1_content = (
        page_height
        - metadata.page.margin_top
        - metadata.page.margin_bottom
        - metadata.page.static_block_height_pt
    )
    continuation_content = (
        page_height - metadata.page.margin_top - metadata.page.margin_bottom
    )
    if rows:
        # Phân trang theo chiều cao an toàn (= max nội dung) để không tràn trang,
        # rồi gán lại chiều cao từng dòng theo nội dung ô.
        pages = apply_content_row_heights(
            plan_pages(
                n_rows=len(rows),
                page_content_height=page1_content,
                continuation_content_height=continuation_content,
                header_height=table.header_height_pt,
                carry_row_height=max(
                    table.carry_height_pt,
                    max(natural_height, table.row_height_min),
                ),
                signature_block_height=sig_height,
                row_height_min=max(natural_height, table.row_height_min),
                row_height_max=max(natural_height, table.row_height_max),
                min_rows_last_page=table.min_rows_last_page,
            ).pages,
            needed_heights,
        )
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
    content_width = page_width - metadata.page.margin_left - metadata.page.margin_right
    static_layers = _cells_by_layer(metadata)
    resolved_signatures = signatures or {}
    resolved_dates = signature_dates or {}
    for page in pages:
        if page.page_index == 0:
            _draw_static_fields(
                pdf,
                metadata=metadata,
                fields=fields,
                content_width=content_width,
            )
            _draw_static_cells(pdf, static_layers["body"])
        _draw_page(
            pdf,
            page=page,
            rows=rows,
            metadata=metadata,
            columns=columns,
            page_height=page_height,
            static_layers=static_layers,
            row_font_name=row_font_name,
            row_font_size=row_font_size,
            signatures=resolved_signatures,
            signature_dates=resolved_dates,
            amount_in_words_text=amount_in_words_text,
        )
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def render_demo_pdf(
    *,
    fields: dict[str, str],
    rows: list[dict[str, str]],
    signatures: dict[str, str] | None = None,
    signature_dates: dict[str, str] | None = None,
) -> bytes:
    return render_pdf(
        metadata=build_demo_metadata(),
        fields=fields,
        rows=rows,
        signatures=signatures,
        signature_dates=signature_dates,
    )


__all__ = ["render_demo_pdf", "render_pdf"]
