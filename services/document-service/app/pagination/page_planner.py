from dataclasses import dataclass, replace
from math import floor
from typing import List, Optional, Sequence


class PaginationError(ValueError):
    """Pagination input or feasibility failure."""


@dataclass
class PagePlan:
    page_index: int
    row_indices: List[int]
    row_heights: List[float]
    has_carry_from_prev: bool
    has_carry_to_next: bool
    is_last: bool


def apply_content_row_heights(
    pages: Sequence[PagePlan],
    content_heights: Sequence[float],
) -> List[PagePlan]:
    """Gán chiều cao theo nội dung từng dòng; phân trang vẫn dùng chiều cao an toàn."""
    return [
        replace(
            page,
            row_heights=[float(content_heights[index]) for index in page.row_indices],
        )
        for page in pages
    ]


@dataclass
class PaginationResult:
    pages: List[PagePlan]
    strategy: str
    row_height_min: float
    row_height_max: float


def _content_height_for_page(
    page_index: int,
    page_content_height: float,
    continuation_content_height: float,
) -> float:
    return page_content_height if page_index == 0 else continuation_content_height


def _pack(
    *,
    n_rows: int,
    row_height: float,
    page_content_height: float,
    continuation_content_height: float,
    header_height: float,
    carry_row_height: float,
    signature_block_height: float,
    min_rows_last_page: int,
) -> Optional[List[PagePlan]]:
    pages: List[PagePlan] = []
    next_row = 0

    while next_row < n_rows:
        page_index = len(pages)
        content_h = _content_height_for_page(
            page_index, page_content_height, continuation_content_height
        )
        has_carry_from_prev = bool(pages)
        incoming_carry = carry_row_height if has_carry_from_prev else 0
        remaining = n_rows - next_row
        last_height = (
            content_h
            - header_height
            - incoming_carry
            - signature_block_height
        )
        last_capacity = max(0, floor(last_height / row_height))

        if remaining <= last_capacity:
            row_indices = list(range(next_row, n_rows))
            pages.append(
                PagePlan(
                    page_index=page_index,
                    row_indices=row_indices,
                    row_heights=[row_height] * len(row_indices),
                    has_carry_from_prev=has_carry_from_prev,
                    has_carry_to_next=False,
                    is_last=True,
                )
            )
            return pages

        regular_height = (
            content_h
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
                page_index=page_index,
                row_indices=row_indices,
                row_heights=[row_height] * len(row_indices),
                has_carry_from_prev=has_carry_from_prev,
                has_carry_to_next=True,
                is_last=False,
            )
        )
        next_row += rows_on_page

    return pages if pages and pages[-1].is_last else None


def _sum_heights(heights: Sequence[float], start: int, end: int) -> float:
    return float(sum(heights[start:end]))


def _pack_variable(
    *,
    row_heights: Sequence[float],
    page_content_height: float,
    continuation_content_height: float,
    header_height: float,
    carry_row_height: float,
    signature_block_height: float,
    min_rows_last_page: int,
) -> Optional[List[PagePlan]]:
    """Pack theo chiều cao từng dòng — không ép max wrap cho cả bảng."""
    n_rows = len(row_heights)
    pages: List[PagePlan] = []
    next_row = 0

    while next_row < n_rows:
        page_index = len(pages)
        content_h = _content_height_for_page(
            page_index, page_content_height, continuation_content_height
        )
        has_carry_from_prev = bool(pages)
        incoming_carry = carry_row_height if has_carry_from_prev else 0
        remaining = n_rows - next_row
        last_budget = (
            content_h - header_height - incoming_carry - signature_block_height
        )
        remaining_sum = _sum_heights(row_heights, next_row, n_rows)

        if remaining_sum <= last_budget + 1e-6:
            if remaining >= min_rows_last_page or n_rows < min_rows_last_page:
                row_indices = list(range(next_row, n_rows))
                pages.append(
                    PagePlan(
                        page_index=page_index,
                        row_indices=row_indices,
                        row_heights=[float(row_heights[i]) for i in row_indices],
                        has_carry_from_prev=has_carry_from_prev,
                        has_carry_to_next=False,
                        is_last=True,
                    )
                )
                return pages

        regular_budget = content_h - header_height - incoming_carry - carry_row_height
        take = 0
        acc = 0.0
        for i in range(next_row, n_rows):
            h = float(row_heights[i])
            if take > 0 and acc + h > regular_budget + 1e-6:
                break
            if take == 0 and h > regular_budget + 1e-6:
                return None
            acc += h
            take += 1

        if take <= 0:
            return None

        # Giữ tối thiểu min_rows_last_page cho trang chữ ký khi còn đủ dòng.
        if remaining > min_rows_last_page and remaining - take < min_rows_last_page:
            take = remaining - min_rows_last_page
            if take <= 0:
                return None
            # Kiểm tra lại các dòng đã chọn vẫn fit budget (take nhỏ hơn → luôn fit).

        if take >= remaining:
            # Còn dòng nhưng không đủ chỗ chữ ký → phải tách; nhường ít nhất 1 dòng.
            take = max(1, remaining - max(1, min_rows_last_page))
            if take >= remaining:
                return None

        row_indices = list(range(next_row, next_row + take))
        pages.append(
            PagePlan(
                page_index=page_index,
                row_indices=row_indices,
                row_heights=[float(row_heights[i]) for i in row_indices],
                has_carry_from_prev=has_carry_from_prev,
                has_carry_to_next=True,
                is_last=False,
            )
        )
        next_row += take

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
    continuation_content_height: Optional[float] = None,
    content_row_heights: Optional[Sequence[float]] = None,
) -> PaginationResult:
    if n_rows < 0:
        raise PaginationError("Số dòng không được âm")
    if row_height_min <= 0 or row_height_min > row_height_max:
        raise PaginationError("Khoảng chiều cao dòng không hợp lệ")
    if stretch_strategy != "end_bias":
        raise PaginationError("Chiến lược giãn dòng không được hỗ trợ")
    if n_rows == 0:
        return PaginationResult([], stretch_strategy, row_height_min, row_height_max)

    cont_h = (
        page_content_height
        if continuation_content_height is None
        else float(continuation_content_height)
    )
    if cont_h < page_content_height:
        raise PaginationError(
            "Chiều cao trang tiếp không được nhỏ hơn trang đầu (static header)"
        )

    if content_row_heights is not None:
        if len(content_row_heights) != n_rows:
            raise PaginationError("Số chiều cao dòng không khớp số dòng")
        pages = _pack_variable(
            row_heights=content_row_heights,
            page_content_height=page_content_height,
            continuation_content_height=cont_h,
            header_height=header_height,
            carry_row_height=carry_row_height,
            signature_block_height=signature_block_height,
            min_rows_last_page=min_rows_last_page,
        )
        if pages is None:
            raise PaginationError(
                "Phân trang không khả thi với giới hạn chiều cao dòng đã cho"
            )
        if n_rows >= min_rows_last_page and len(pages[-1].row_indices) < min_rows_last_page:
            raise PaginationError(
                "Phân trang không khả thi với giới hạn chiều cao dòng đã cho"
            )
        return PaginationResult(
            pages=pages,
            strategy=stretch_strategy,
            row_height_min=row_height_min,
            row_height_max=row_height_max,
        )

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
            continuation_content_height=cont_h,
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

    raise PaginationError("Phân trang không khả thi với giới hạn chiều cao dòng đã cho")
