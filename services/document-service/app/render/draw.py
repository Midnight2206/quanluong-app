from __future__ import annotations

from typing import Literal, Sequence

from reportlab.pdfbase.pdfmetrics import stringWidth

from app.render.demo_template import ColumnDef
from app.render.font_style import render_font
from app.render.text_wrap import CELL_PADDING_PT, line_height_for, wrap_text_to_width

Align = Literal["left", "center", "right"]
VAlign = Literal["top", "middle", "center"]


def _normalize_align_h(value: str | None) -> Align:
    if value in {"left", "center", "right"}:
        return value
    return "left"


def _normalize_valign(value: str | None) -> VAlign:
    if value in {"top", "middle", "center"}:
        return "middle" if value == "center" else value
    return "middle"


def has_visible_border(border: dict | None) -> bool:
    if not border:
        return False
    return any(border.get(side) for side in ("left", "right", "top", "bottom"))


def _draw_side_borders(
    canvas,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    border: dict | None,
) -> None:
    if not has_visible_border(border):
        return
    canvas.setLineWidth(0.5)
    if border.get("left"):
        canvas.line(x, y, x, y + height)
    if border.get("right"):
        canvas.line(x + width, y, x + width, y + height)
    if border.get("bottom"):
        canvas.line(x, y, x + width, y)
    if border.get("top"):
        canvas.line(x, y + height, x + width, y + height)


def _draw_cell_border(
    canvas,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    border: dict | None,
) -> None:
    """None = khung đầy đủ (demo); dict = chỉ vẽ cạnh Excel có style."""
    if border is None:
        draw_rect_border(canvas, x=x, y=y, width=width, height=height)
        return
    _draw_side_borders(canvas, x=x, y=y, width=width, height=height, border=border)


def draw_table_header_frame(
    canvas,
    *,
    x: float,
    y_top: float,
    width: float,
    height: float,
) -> None:
    """Khung header đầy đủ mỗi trang — sửa mất cạnh trên từ trang 2+."""
    canvas.setLineWidth(0.5)
    canvas.rect(x, y_top - height, width, height, stroke=1, fill=0)


def draw_static_cell(
    canvas,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    value: str,
    font: dict | None = None,
    align: dict | None = None,
    border: dict | None = None,
) -> None:
    font_name, font_size = render_font(font)
    align_h = _normalize_align_h((align or {}).get("h"))
    valign = _normalize_valign((align or {}).get("v"))
    wrap_text = bool((align or {}).get("wrap_text"))
    # Chỉ vẽ border khi Excel có style — không tự bịa khung vì cell có chữ.
    _draw_side_borders(canvas, x=x, y=y, width=width, height=height, border=border)
    if not value:
        return
    if wrap_text:
        _draw_wrapped_lines(
            canvas,
            x=x,
            y=y,
            width=width,
            height=height,
            text=value,
            font_name=font_name,
            font_size=font_size,
            align=align_h,
            valign=valign,
        )
    else:
        if valign == "top":
            text_y = y + height - CELL_PADDING_PT - font_size
        else:
            # Đồng bộ với middle của dòng wrap / carry.
            text_y = y + height / 2 - font_size / 2
        draw_text(
            canvas,
            x=x + CELL_PADDING_PT,
            y=text_y,
            text=value,
            font_name=font_name,
            font_size=font_size,
            align=align_h,
            max_width=width - 2 * CELL_PADDING_PT,
        )


def _fit_text(text: str, font_name: str, font_size: float, max_width: float) -> str:
    if stringWidth(text, font_name, font_size) <= max_width:
        return text
    ellipsis = "..."
    while text and stringWidth(text + ellipsis, font_name, font_size) > max_width:
        text = text[:-1]
    return text + ellipsis if text else ellipsis


def _text_x(
    x: float,
    text: str,
    font_name: str,
    font_size: float,
    align: Align,
    max_width: float | None,
) -> float:
    text_width = stringWidth(text, font_name, font_size)
    if align == "center":
        if max_width is not None:
            return x + (max_width - text_width) / 2
        return x - text_width / 2
    if align == "right":
        if max_width is not None:
            return x + max_width - text_width
        return x - text_width
    return x


def draw_text(
    canvas,
    *,
    x: float,
    y: float,
    text: str,
    font_name: str,
    font_size: float,
    align: Align = "left",
    max_width: float | None = None,
) -> None:
    canvas.setFont(font_name, font_size)
    display = str(text)
    if max_width is not None:
        display = _fit_text(display, font_name, font_size, max_width)
    tx = _text_x(x, display, font_name, font_size, align, max_width)
    canvas.drawString(tx, y, display)


def _draw_wrapped_lines(
    canvas,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    text: str,
    font_name: str,
    font_size: float,
    align: Align,
    valign: VAlign,
) -> None:
    inner_width = max(width - 2 * CELL_PADDING_PT, 1.0)
    lines = wrap_text_to_width(text, font_name, font_size, inner_width)
    line_height = line_height_for(font_size)
    block_height = len(lines) * line_height
    if valign == "top":
        first_y = y + height - CELL_PADDING_PT - font_size
    else:
        # Căn giữa khối chữ theo chiều dọc (baseline dòng đầu).
        first_y = y + (height + block_height) / 2 - font_size
    canvas.setFont(font_name, font_size)
    for index, line in enumerate(lines):
        ty = first_y - index * line_height
        if ty < y:
            break
        tx = _text_x(x + CELL_PADDING_PT, line, font_name, font_size, align, inner_width)
        canvas.drawString(tx, ty, line)


def draw_rect_border(
    canvas,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    line_width: float = 0.5,
) -> None:
    canvas.setLineWidth(line_width)
    canvas.rect(x, y, width, height, stroke=1, fill=0)


def draw_merged_cell(
    canvas,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    text: str,
    font_name: str,
    font_size: float,
    align: Align = "center",
    valign: VAlign = "middle",
    border: dict | None = None,
) -> None:
    _draw_cell_border(canvas, x=x, y=y, width=width, height=height, border=border)
    _draw_wrapped_lines(
        canvas,
        x=x,
        y=y,
        width=width,
        height=height,
        text=text,
        font_name=font_name,
        font_size=font_size,
        align=align,
        valign=valign,
    )


def draw_table_row(
    canvas,
    *,
    x: float,
    y: float,
    height: float,
    columns: Sequence[str] | None,
    values: dict[str, str],
    col_defs: Sequence[ColumnDef],
    font_name: str,
    font_size: float,
    valign: VAlign = "middle",
    border: dict | None = None,
) -> None:
    cx = x
    for index, col in enumerate(col_defs):
        if columns is not None and index < len(columns):
            cell_text = columns[index]
        else:
            cell_text = values.get(col.key, "")
        draw_merged_cell(
            canvas,
            x=cx,
            y=y,
            width=col.width,
            height=height,
            text=cell_text,
            font_name=font_name,
            font_size=font_size,
            align=col.align,
            valign=valign,
            border=border,
        )
        cx += col.width


__all__ = [
    "draw_merged_cell",
    "draw_rect_border",
    "draw_static_cell",
    "draw_table_header_frame",
    "draw_table_row",
    "draw_text",
    "has_visible_border",
]
