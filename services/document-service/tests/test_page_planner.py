import pytest

from app.pagination.page_planner import apply_content_row_heights, plan_pages


def test_single_page_all_rows():
    result = plan_pages(
        n_rows=3,
        page_content_height=200,
        header_height=20,
        signature_block_height=40,
    )

    assert len(result.pages) == 1
    assert result.pages[0].row_indices == [0, 1, 2]
    assert result.pages[0].is_last is True
    assert all(18 <= height <= 28 for height in result.pages[0].row_heights)


def test_apply_content_row_heights_keeps_short_rows_short():
    planned = plan_pages(
        n_rows=4,
        page_content_height=500,
        header_height=20,
        signature_block_height=40,
        row_height_min=36,
        row_height_max=36,
    )
    content = [18.0, 18.0, 36.0, 18.0]
    pages = apply_content_row_heights(planned.pages, content)

    assert len(pages) == 1
    assert pages[0].row_heights == content
    assert pages[0].row_indices == [0, 1, 2, 3]


def test_uniform_search_keeps_at_least_two_rows_on_last_page():
    # At 18pt the first page holds four rows, orphaning one. At 20.5pt it
    # holds three, so this tuned fixture exercises both pagination and the rule.
    result = plan_pages(
        n_rows=5,
        page_content_height=100,
        header_height=10,
        carry_row_height=10,
        signature_block_height=20,
    )

    assert [page.row_indices for page in result.pages] == [[0, 1, 2], [3, 4]]
    assert result.pages[-1].is_last is True
    assert len(result.pages[-1].row_indices) >= 2
    assert {height for page in result.pages for height in page.row_heights} == {20.5}
    assert result.strategy == "end_bias"


def test_regular_page_defers_minimum_rows_for_signature_page():
    result = plan_pages(
        n_rows=3,
        page_content_height=100,
        header_height=10,
        carry_row_height=0,
        signature_block_height=50,
    )

    assert [page.row_indices for page in result.pages] == [[0], [1, 2]]
    assert len(result.pages[-1].row_indices) >= 2


def test_continuation_page_uses_taller_budget():
    """Trang 2+ không trừ static header → nhét được nhiều dòng hơn trang 1."""
    page1 = 100.0
    continuation = 180.0
    result = plan_pages(
        n_rows=20,
        page_content_height=page1,
        continuation_content_height=continuation,
        header_height=10,
        carry_row_height=10,
        signature_block_height=20,
        row_height_min=18,
        row_height_max=18,
        min_rows_last_page=2,
    )
    assert len(result.pages) >= 2
    # Trang 1: (100-10-10)/18 = 4 dòng; trang giữa: (180-10-10-10)/18 = 8
    assert len(result.pages[0].row_indices) == 4
    assert len(result.pages[1].row_indices) == 8


def test_infeasible_raises_vietnamese_error():
    # Header and signature exceed the 40pt page before any 18pt row can fit.
    with pytest.raises(ValueError, match="không"):
        plan_pages(
            n_rows=50,
            page_content_height=40,
            header_height=30,
            signature_block_height=20,
        )


def test_variable_row_heights_packs_dense_short_rows():
    """Một dòng wrap cao không được ép mọi dòng = max (BKMH hay dính)."""
    heights = [80.0, 18.0, 18.0, 18.0, 18.0]
    # Uniform 80pt: mỗi trang ~1 dòng → trang cuối orphan < min_rows_last_page → fail.
    result = plan_pages(
        n_rows=len(heights),
        page_content_height=200,
        header_height=40,
        carry_row_height=20,
        signature_block_height=80,
        row_height_min=18,
        row_height_max=28,
        min_rows_last_page=2,
        content_row_heights=heights,
    )
    assert len(result.pages) >= 2
    assert result.pages[-1].is_last is True
    assert len(result.pages[-1].row_indices) >= 2
    assert [h for p in result.pages for h in p.row_heights] == heights
