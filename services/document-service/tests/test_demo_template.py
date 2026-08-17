from app.render.demo_template import (
    CONTENT_WIDTH,
    DEMO_COLUMNS,
    PAGE_HEIGHT,
    STATIC_BLOCK_HEIGHT,
    content_height_continuation,
    content_height_page1,
    table_top_y_page1,
)


def test_columns_sum_fits_page():
    assert sum(c.width for c in DEMO_COLUMNS) <= CONTENT_WIDTH
    assert content_height_page1() > 100


def test_content_heights():
    assert content_height_page1() == PAGE_HEIGHT - 40 - 40 - STATIC_BLOCK_HEIGHT
    assert content_height_continuation() == PAGE_HEIGHT - 40 - 40
    assert content_height_page1() < content_height_continuation()


def test_table_top_y_page1():
    assert table_top_y_page1() == PAGE_HEIGHT - 40 - STATIC_BLOCK_HEIGHT
