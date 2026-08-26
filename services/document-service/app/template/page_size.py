from __future__ import annotations

from reportlab.lib import pagesizes

from .metadata import PageMeta


def page_dimensions(page: PageMeta) -> tuple[float, float]:
    size = getattr(pagesizes, page.page_size.upper(), pagesizes.A4)
    width, height = (round(dimension) for dimension in size)
    if page.orientation == "landscape":
        return height, width
    return width, height


__all__ = ["page_dimensions"]
