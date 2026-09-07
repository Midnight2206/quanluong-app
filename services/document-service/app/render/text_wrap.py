from __future__ import annotations

from reportlab.pdfbase.pdfmetrics import stringWidth

CELL_PADDING_PT = 2.0
LINE_HEIGHT_RATIO = 1.2
_BALANCE_SEARCH_STEPS = 24


def line_height_for(font_size: float) -> float:
    return font_size * LINE_HEIGHT_RATIO


def wrap_text_to_width(
    text: str,
    font_name: str,
    font_size: float,
    max_width_pt: float,
    *,
    balance: bool = False,
) -> list[str]:
    """Ngắt text theo độ rộng thật (stringWidth).

    `balance=True` (bảng dữ liệu): cân độ dài các dòng khi wrap.
    Field / static cell giữ greedy mặc định.
    """
    raw = "" if text is None else str(text)
    if max_width_pt <= 0:
        return raw.split("\n") or [""]
    lines: list[str] = []
    for paragraph in raw.split("\n"):
        lines.extend(
            _wrap_paragraph(
                paragraph,
                font_name,
                font_size,
                max_width_pt,
                balance=balance,
            )
        )
    return lines or [""]


def _greedy_wrap_paragraph(
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


def _balance_wrap_paragraph(
    paragraph: str,
    font_name: str,
    font_size: float,
    max_width_pt: float,
    target_lines: int,
) -> list[str]:
    """Giữ cùng số dòng với greedy, thu hẹp độ rộng hiệu dụng để các dòng đều hơn.

    Giống text-wrap: balance — tìm width nhỏ nhất mà vẫn wrap ≤ target_lines.
    """
    greedy = _greedy_wrap_paragraph(paragraph, font_name, font_size, max_width_pt)
    if target_lines <= 1 or len(greedy) <= 1:
        return greedy

    lo = 0.0
    hi = float(max_width_pt)
    best = greedy
    for _ in range(_BALANCE_SEARCH_STEPS):
        mid = (lo + hi) / 2.0
        trial = _greedy_wrap_paragraph(paragraph, font_name, font_size, mid)
        if len(trial) <= target_lines:
            best = trial
            hi = mid
        else:
            lo = mid

    if len(best) > target_lines:
        return greedy
    # Mỗi dòng vẫn phải ≤ max_width_pt (greedy với hi ≤ max_width).
    return best


def _wrap_paragraph(
    paragraph: str,
    font_name: str,
    font_size: float,
    max_width_pt: float,
    *,
    balance: bool = False,
) -> list[str]:
    greedy = _greedy_wrap_paragraph(paragraph, font_name, font_size, max_width_pt)
    if not balance or len(greedy) <= 1:
        return greedy
    return _balance_wrap_paragraph(
        paragraph,
        font_name,
        font_size,
        max_width_pt,
        target_lines=len(greedy),
    )


def measure_wrapped_height(
    text: str,
    font_name: str,
    font_size: float,
    max_width_pt: float,
    line_height: float,
    *,
    balance: bool = False,
) -> float:
    lines = wrap_text_to_width(
        text, font_name, font_size, max_width_pt, balance=balance
    )
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
                balance=True,
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
