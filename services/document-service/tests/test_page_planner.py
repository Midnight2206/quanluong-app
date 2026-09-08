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
    # Reserve Cộng trên trang cuối (= row_height). Fixture đủ chỗ cho 2 dòng + Cộng + sig.
    result = plan_pages(
        n_rows=5,
        page_content_height=130,
        header_height=10,
        carry_row_height=10,
        signature_block_height=20,
    )

    assert len(result.pages) >= 2
    assert result.pages[-1].is_last is True
    assert len(result.pages[-1].row_indices) >= 2
    assert result.strategy == "end_bias"


def test_regular_page_defers_minimum_rows_for_signature_page():
    """Khi phải tách trang, trang chữ ký vẫn giữ ≥ min_rows_last_page (có trừ Cộng)."""
    result = plan_pages(
        n_rows=8,
        page_content_height=150,
        header_height=10,
        carry_row_height=0,
        signature_block_height=40,
        min_rows_last_page=2,
    )
    assert len(result.pages) >= 2
    assert result.pages[-1].is_last is True
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
    # Carry vẽ = max(10, 18)=18. Trang 1: (100-10-18)/18 = 4; giữa: (180-10-18-18)/18 = 7
    assert len(result.pages[0].row_indices) == 4
    assert len(result.pages[1].row_indices) == 7


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


def test_variable_last_page_reserves_cong_carry_for_margin():
    """Trang cuối vẽ thêm dòng Cộng (= max row) — phải trừ khỏi budget kẻo lọt margin_bottom."""
    # Không reserve Cộng: 135+30 ≤ 190 → 1 trang; lúc vẽ 10+135+45+30 = 220 > 200.
    heights = [45.0, 45.0, 45.0]
    result = plan_pages(
        n_rows=3,
        page_content_height=200,
        header_height=10,
        carry_row_height=18,
        signature_block_height=30,
        min_rows_last_page=1,
        content_row_heights=heights,
    )
    last = result.pages[-1]
    assert last.is_last
    assert len(result.pages) >= 2  # phải tách trang vì Cộng
    row_sum = sum(last.row_heights)
    cong = max(18.0, max(last.row_heights))
    incoming = 0.0
    if last.has_carry_from_prev:
        prev = result.pages[-2]
        incoming = max(18.0, max(prev.row_heights))
    used = 10 + incoming + row_sum + cong + 30
    assert used <= 200 + 1e-6, f"last page used {used} > content 200"
