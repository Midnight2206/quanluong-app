from __future__ import annotations

from typing import Literal, Sequence

from reportlab.pdfbase.pdfmetrics import stringWidth

from app.render.demo_template import ColumnDef
from app.render.fonts import FONT_BOLD, FONT_REGULAR

Align = Literal["left", "center", "right"]
VAlign = Literal["top", "middle"]

_CELL_PAD = 2


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
) -> None:
    draw_rect_border(canvas, x=x, y=y, width=width, height=height)
    if valign == "middle":
        text_y = y + height / 2 - font_size / 3
    else:
        text_y = y + height - font_size - _CELL_PAD
    draw_text(
        canvas,
        x=x + _CELL_PAD,
        y=text_y,
        text=text,
        font_name=font_name,
        font_size=font_size,
        align=align,
        max_width=width - 2 * _CELL_PAD,
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
            font_name=FONT_REGULAR,
            font_size=10,
            align=col.align,
            valign="middle",
        )
        cx += col.width


__all__ = [
    "FONT_BOLD",
    "FONT_REGULAR",
    "draw_merged_cell",
    "draw_rect_border",
    "draw_table_row",
    "draw_text",
]
