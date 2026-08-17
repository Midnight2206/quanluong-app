from io import BytesIO

from pypdf import PdfReader

from app.pagination import plan_pages
from app.render.demo_template import (
    CARRY_HEIGHT,
    HEADER_HEIGHT,
    MIN_ROWS_LAST_PAGE,
    ROW_HEIGHT_MAX,
    ROW_HEIGHT_MIN,
    SIGNATURE_HEIGHT,
    content_height_page1,
)
from app.render.pdf_renderer import render_demo_pdf


def _sample_fields():
    return {
        "tieu_de": "PHIẾU XUẤT KHO DEMO",
        "don_vi": "Bếp ăn A",
        "ngay_thang": "17/08/2026",
        "so_phieu": "PX-001",
    }


def _sample_rows(n):
    return [
        {
            "stt": str(i + 1),
            "ten_hang": f"Mặt hàng {i + 1}",
            "don_vi_tinh": "kg",
            "so_luong": "10",
            "thanh_tien": "100000",
        }
        for i in range(n)
    ]


def test_pdf_magic_bytes():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=_sample_rows(3))

    assert pdf[:4] == b"%PDF"


def test_vietnamese_text_extracted():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=_sample_rows(1))

    text = "".join(page.extract_text() or "" for page in PdfReader(BytesIO(pdf)).pages)
    assert "Đơn vị" in text
    assert "Thành tiền" in text


def test_multi_page_pdf_matches_first_page_plan():
    rows = _sample_rows(45)
    pdf = render_demo_pdf(fields=_sample_fields(), rows=rows)
    expected = plan_pages(
        n_rows=len(rows),
        page_content_height=content_height_page1(),
        header_height=HEADER_HEIGHT,
        carry_row_height=CARRY_HEIGHT,
        signature_block_height=SIGNATURE_HEIGHT,
        row_height_min=ROW_HEIGHT_MIN,
        row_height_max=ROW_HEIGHT_MAX,
        min_rows_last_page=MIN_ROWS_LAST_PAGE,
    )
    actual_pages = PdfReader(BytesIO(pdf)).pages

    assert len(actual_pages) == len(expected.pages) >= 2
    assert [
        (page.extract_text() or "").count("Mặt hàng") for page in actual_pages
    ] == [len(page.row_indices) for page in expected.pages]
    assert len(expected.pages[-1].row_indices) >= MIN_ROWS_LAST_PAGE


def test_three_rows_single_page():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=_sample_rows(3))

    assert len(PdfReader(BytesIO(pdf)).pages) == 1


def test_empty_rows_one_page():
    pdf = render_demo_pdf(fields=_sample_fields(), rows=[])

    assert len(PdfReader(BytesIO(pdf)).pages) == 1
