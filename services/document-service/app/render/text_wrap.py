from __future__ import annotations

from reportlab.pdfbase.pdfmetrics import stringWidth

CELL_PADDING_PT = 2.0
LINE_HEIGHT_RATIO = 1.2


def line_height_for(font_size: float) -> float:
    return font_size * LINE_HEIGHT_RATIO


def wrap_text_to_width(
    text: str,
    font_name: str,
    font_size: float,
    max_width_pt: float,
) -> list[str]:
    """Ngắt text theo độ rộng thật (stringWidth), không theo số ký tự.

    Từ đơn dài hơn max_width_pt giữ nguyên 1 dòng (chấp nhận tràn nhẹ).
    """
    raw = "" if text is None else str(text)
    if max_width_pt <= 0:
        return raw.split("\n") or [""]
    lines: list[str] = []
    for paragraph in raw.split("\n"):
        lines.extend(_wrap_paragraph(paragraph, font_name, font_size, max_width_pt))
    return lines or [""]


def _wrap_paragraph(
    paragraph: str,
    font_name: str,
    font_size: float,
    max_width_pt: float,
) -> list[str]:
    words = paragraph.split()
    if not words:
        return [""]
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if stringWidth(candidate, font_name, font_size) <= max_width_pt:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
    if current:
        lines.append(current)
    return lines


def measure_wrapped_height(
    text: str,
    font_name: str,
    font_size: float,
    max_width_pt: float,
    line_height: float,
) -> float:
    lines = wrap_text_to_width(text, font_name, font_size, max_width_pt)
    return len(lines) * line_height


def _column_width(column) -> float:
    return float(getattr(column, "width_pt", None) or column.width)


def compute_row_height(
    row: dict,
    columns: list,
    font_name: str,
    font_size: float,
    line_height: float,
    row_height_min: float,
) -> float:
    """Chiều cao dòng = max wrap của các cột, không nhỏ hơn row_height_min."""
    heights = []
    for column in columns:
        inner_width = max(_column_width(column) - 2 * CELL_PADDING_PT, 1.0)
        heights.append(
            measure_wrapped_height(
                text=str(row.get(column.key, "") or ""),
                font_name=font_name,
                font_size=font_size,
                max_width_pt=inner_width,
                line_height=line_height,
            )
        )
    return max(max(heights, default=line_height), row_height_min)


__all__ = [
    "CELL_PADDING_PT",
    "LINE_HEIGHT_RATIO",
    "compute_row_height",
    "line_height_for",
    "measure_wrapped_height",
    "wrap_text_to_width",
]
