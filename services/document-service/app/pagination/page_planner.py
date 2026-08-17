from dataclasses import dataclass
from math import floor
from typing import List, Optional


@dataclass
class PagePlan:
    page_index: int
    row_indices: List[int]
    row_heights: List[float]
    has_carry_from_prev: bool
    has_carry_to_next: bool
    is_last: bool


@dataclass
class PaginationResult:
    pages: List[PagePlan]
    strategy: str
    row_height_min: float
    row_height_max: float


def _pack(
    *,
    n_rows: int,
    row_height: float,
    page_content_height: float,
    header_height: float,
    carry_row_height: float,
    signature_block_height: float,
    min_rows_last_page: int,
) -> Optional[List[PagePlan]]:
    pages: List[PagePlan] = []
    next_row = 0

    while next_row < n_rows:
        has_carry_from_prev = bool(pages)
        incoming_carry = carry_row_height if has_carry_from_prev else 0
        remaining = n_rows - next_row
        last_height = (
            page_content_height
            - header_height
            - incoming_carry
            - signature_block_height
        )
        last_capacity = max(0, floor(last_height / row_height))

        if remaining <= last_capacity:
            row_indices = list(range(next_row, n_rows))
            pages.append(
                PagePlan(
                    page_index=len(pages),
                    row_indices=row_indices,
                    row_heights=[row_height] * len(row_indices),
                    has_carry_from_prev=has_carry_from_prev,
                    has_carry_to_next=False,
                    is_last=True,
                )
            )
            return pages

        regular_height = (
            page_content_height
            - header_height
            - incoming_carry
            - carry_row_height
        )
        regular_capacity = max(0, floor(regular_height / row_height))
        if regular_capacity <= 0:
            return None
        rows_on_page = regular_capacity
        if regular_capacity >= remaining:
            rows_on_page = min(
                regular_capacity, max(1, remaining - min_rows_last_page)
            )

        row_indices = list(range(next_row, next_row + rows_on_page))
        pages.append(
            PagePlan(
                page_index=len(pages),
                row_indices=row_indices,
                row_heights=[row_height] * len(row_indices),
                has_carry_from_prev=has_carry_from_prev,
                has_carry_to_next=True,
                is_last=False,
            )
        )
        next_row += rows_on_page

    return pages if pages and pages[-1].is_last else None


def plan_pages(
    *,
    n_rows: int,
    page_content_height: float,
    header_height: float = 0,
    carry_row_height: float = 0,
    signature_block_height: float = 0,
    row_height_min: float = 18,
    row_height_max: float = 28,
    min_rows_last_page: int = 2,
    stretch_strategy: str = "end_bias",
) -> PaginationResult:
    if n_rows < 0:
        raise ValueError("Số dòng không được âm")
    if row_height_min <= 0 or row_height_min > row_height_max:
        raise ValueError("Khoảng chiều cao dòng không hợp lệ")
    if stretch_strategy != "end_bias":
        raise ValueError("Chiến lược giãn dòng không được hỗ trợ")
    if n_rows == 0:
        return PaginationResult([], stretch_strategy, row_height_min, row_height_max)

    # ponytail: uniform-height search only; upgrade to true end_bias by
    # stretching trailing rows while keeping the requested strategy echo.
    steps = floor((row_height_max - row_height_min) * 2)
    candidates = [row_height_min + step * 0.5 for step in range(steps + 1)]
    if candidates[-1] < row_height_max:
        candidates.append(row_height_max)

    for row_height in candidates:
        pages = _pack(
            n_rows=n_rows,
            row_height=row_height,
            page_content_height=page_content_height,
            header_height=header_height,
            carry_row_height=carry_row_height,
            signature_block_height=signature_block_height,
            min_rows_last_page=min_rows_last_page,
        )
        if pages is None:
            continue
        if n_rows >= min_rows_last_page and len(pages[-1].row_indices) < min_rows_last_page:
            continue
        return PaginationResult(
            pages=pages,
            strategy=stretch_strategy,
            row_height_min=row_height_min,
            row_height_max=row_height_max,
        )

    raise ValueError("Phân trang không khả thi với giới hạn chiều cao dòng đã cho")
