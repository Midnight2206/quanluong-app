from __future__ import annotations

import re

from app.render.carry_totals import find_amount_column_key, sum_amount
from app.render.draw import draw_text
from app.render.fonts import FONT_BOLD
from app.render.text_wrap import (
    line_height_for,
    measure_wrapped_height,
    wrap_text_to_width,
)
from app.render.vnd_words import vnd_to_vietnamese_document_line

AMOUNT_IN_WORDS_PREFIX = "Tổng số tiền (Viết bằng chữ): "
SKIP_SCALAR_FIELD_NAMES = frozenset({"tong_tien_bang_chu"})


def should_skip_scalar_field(field_name: str) -> bool:
    key = str(field_name or "").strip().lower()
    return key in SKIP_SCALAR_FIELD_NAMES


def try_parse_amount(value) -> float | None:
    """Like parse_amount but returns None when the value is empty or unparseable."""
    raw = str(value or "").strip().replace(" ", "").replace("\u00a0", "")
    if not raw:
        return None
    if re.fullmatch(r"-?\d+", raw):
        return float(raw)
    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            cleaned = raw.replace(".", "").replace(",", ".")
        else:
            cleaned = raw.replace(",", "")
    elif raw.count(".") > 1:
        cleaned = raw.replace(".", "")
    elif raw.count(",") > 1:
        cleaned = raw.replace(",", "")
    elif "," in raw:
        left, _, right = raw.partition(",")
        cleaned = f"{left}.{right}" if len(right) <= 2 else raw.replace(",", "")
    elif "." in raw:
        left, _, right = raw.partition(".")
        if left.lstrip("-").isdigit() and right.isdigit() and len(right) == 3:
            cleaned = left + right
        else:
            cleaned = raw
    else:
        cleaned = raw
    try:
        return float(cleaned)
    except ValueError:
        return None


def resolve_document_amount(fields, rows, columns) -> float | None:
    payload = fields if isinstance(fields, dict) else {}
    for key in ("tong_tien", "tong_tien_so"):
        if key not in payload:
            continue
        raw = payload.get(key)
        if raw is None or str(raw).strip() == "":
            continue
        parsed = try_parse_amount(raw)
        if parsed is not None:
            return parsed
    amount_key = find_amount_column_key(columns)
    if not amount_key:
        return None
    if not rows:
        return None
    return sum_amount(rows, amount_key)


def format_amount_in_words_line(amount: float) -> str:
    words = vnd_to_vietnamese_document_line(amount)
    if not words:
        return ""
    return f"{AMOUNT_IN_WORDS_PREFIX}{words}"


def measure_amount_in_words_height(
    text: str,
    font_name: str,
    font_size: float,
    max_width: float,
) -> float:
    if not text:
        return 0.0
    return measure_wrapped_height(
        text, font_name, font_size, max_width, line_height_for(font_size)
    )


def draw_amount_in_words_line(
    pdf,
    *,
    text: str,
    x: float,
    y_top: float,
    max_width: float,
    font_size: float,
) -> float:
    """Draw bold wrapped lines; return y just below the block."""
    if not text or max_width <= 0:
        return y_top
    gap_before = 6.0
    line_h = line_height_for(font_size)
    lines = wrap_text_to_width(text, FONT_BOLD, font_size, max_width)
    y = y_top - gap_before
    for line in lines:
        y -= line_h
        draw_text(
            pdf,
            x=x,
            y=y,
            text=line,
            font_name=FONT_BOLD,
            font_size=font_size,
            align="left",
            max_width=max_width,
        )
    return y
