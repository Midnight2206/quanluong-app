from __future__ import annotations

from app.render.fonts import FONT_BOLD, FONT_REGULAR

EXCEL_DEFAULT_FONT_SIZE = 11.0


def font_size_from_style(font: dict | None, *, default: float = EXCEL_DEFAULT_FONT_SIZE) -> float:
    if not font:
        return default
    size = font.get("size")
    if size is None:
        return default
    try:
        parsed = float(size)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def render_font(font: dict | None) -> tuple[str, float]:
    payload = font or {}
    name = FONT_BOLD if payload.get("bold") else FONT_REGULAR
    return name, font_size_from_style(payload)


def font_dict_from_cell(cell, *, default_size: float = EXCEL_DEFAULT_FONT_SIZE) -> dict:
    size = cell.font.size
    if size is None:
        size = cell.font.sz
    if size is None:
        size = default_size
    return {
        "name": cell.font.name,
        "size": float(size),
        "bold": bool(cell.font.bold),
        "italic": bool(cell.font.italic),
    }
