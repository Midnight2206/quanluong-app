from reportlab.pdfbase.pdfmetrics import stringWidth

import pytest

from app.render.fonts import FONT_BOLD, FONT_REGULAR
from app.render.signature_block import (
    BODY_FONT_SHRINK_MAX_PT,
    COLUMN_GAP_PT,
    MIN_FONT_SIZE_PT,
    ROW_GAP_PT,
    SIGNATURE_BLOCK_MARGIN_PT,
    compute_signature_block_anchor_y,
    default_signature_block,
    draw_signature_block,
    fit_font_size,
    layout_signature_slots,
    parse_signature_block_config,
    resolve_signature_name,
    row_counts_for_slots,
    shared_signature_font_size,
    signature_block_extra_height,
)
from app.render.text_wrap import line_height_for
from app.template.metadata import FieldMeta, PageMeta, SignatureBlockConfig, SignatureSlot
from app.template.page_size import page_dimensions


class _SpyCanvas:
    def __init__(self):
        self.calls = []

    def setFont(self, name, size):
        self.calls.append(("font", name, size))

    def drawCentredString(self, x, y, text):
        self.calls.append(("text", text, x, y))


def test_fit_font_size_unchanged_when_already_fits():
    assert fit_font_size("OK", FONT_BOLD, 200, 11.0) == 11.0


def test_fit_font_size_shrinks_until_fits():
    text = "NGƯỜI LẬP BIÊN BẢN KIỂM KÊ CHI TIẾT RẤT DÀI"
    max_width = 80.0
    size = fit_font_size(text, FONT_BOLD, max_width, 11.0)
    assert size < 11.0
    assert stringWidth(text, FONT_BOLD, size) <= max_width or size == MIN_FONT_SIZE_PT


def test_fit_font_size_floors_at_min_without_cutting():
    assert fit_font_size("X" * 200, FONT_BOLD, 20.0, 11.0, min_size=7.0) == 7.0


def test_compute_anchor_without_extra_fields():
    assert compute_signature_block_anchor_y(200.0, [], gap_pt=12) == 188.0


def test_compute_anchor_uses_lowest_extra_field():
    fields = [
        FieldMeta("a", "s", "A1", 10, 150),
        FieldMeta("b", "s", "A2", 10, 120),
    ]
    assert compute_signature_block_anchor_y(200.0, fields, gap_pt=12) == 108.0


def test_resolve_static_ignores_payload_override():
    slot = SignatureSlot(
        key="thu_truong",
        label="Thủ trưởng",
        col=1,
        source="static",
        static_name="Trần Văn A",
    )
    assert resolve_signature_name(slot, {"thu_truong": "HACK"}) == "Trần Văn A"


def test_resolve_dynamic_empty_when_missing():
    slot = SignatureSlot(key="nguoi_lap", label="Người lập", col=0)
    assert resolve_signature_name(slot, {}) == ""


def test_static_slot_requires_static_name():
    with pytest.raises(ValueError, match="static_name"):
        SignatureBlockConfig(
            columns=1,
            slots=[SignatureSlot(key="x", label="X", col=0, source="static")],
        )


def test_static_slot_allows_empty_static_name():
    config = SignatureBlockConfig(
        columns=1,
        slots=[
            SignatureSlot(key="nguoi_nhan", label="Người nhận", col=0, source="static", static_name=""),
        ],
    )
    assert config.slots[0].static_name == ""
    assert resolve_signature_name(config.slots[0], {}) == ""


def test_parse_preserves_empty_static_name():
    config = parse_signature_block_config(
        {
            "columns": 1,
            "slots": [
                {
                    "key": "nguoi_nhan",
                    "label": "Người nhận",
                    "col": 0,
                    "source": "static",
                    "static_name": "",
                }
            ],
        }
    )
    assert config is not None
    assert config.slots[0].static_name == ""


def test_date_line_uses_italic_and_body_font_size():
    config = SignatureBlockConfig(
        columns=1,
        gap_pt=40,
        date_line_gap_pt=14,
        slots=[
            SignatureSlot(
                key="nguoi_lap",
                label="Người lập",
                col=0,
                show_date_line=True,
            )
        ],
    )
    spy = _SpyCanvas()
    from app.render.fonts import FONT_ITALIC

    draw_signature_block(
        spy,
        config=config,
        signatures={"nguoi_lap": "A"},
        signature_dates={"nguoi_lap": "ngày 1 tháng 1 năm 2026"},
        anchor_y=500,
        page=PageMeta(),
        body_font_size=12.0,
    )
    date_fonts = [
        (c[1], c[2])
        for c in spy.calls
        if c[0] == "font" and c[1] == FONT_ITALIC
    ]
    assert date_fonts
    assert date_fonts[0][1] == 12.0


def test_shared_font_shrinks_uniformly_and_floors_at_body_minus_2():
    """Co theo phần dài nhất; mọi dòng cùng size; sàn = body − 2pt."""
    config = SignatureBlockConfig(
        columns=2,
        gap_pt=40,
        date_line_gap_pt=14,
        slots=[
            SignatureSlot(
                key="a",
                label="Người lập biên bản kiểm kê chi tiết rất dài",
                col=0,
                show_date_line=True,
            ),
            SignatureSlot(key="b", label="Thủ trưởng", col=1),
        ],
    )
    page = PageMeta(margin_left=72, margin_right=72)
    body = 11.0
    signatures = {
        "a": "Nguyễn Văn A Có Tên Rất Dài Để Thử Font",
        "b": "B",
    }
    dates = {"a": "Hà Nội, ngày 01 tháng 06 năm 2026"}
    shared = shared_signature_font_size(
        config, signatures, dates, page, body_font_size=body
    )
    assert shared <= body
    assert shared >= body - BODY_FONT_SHRINK_MAX_PT

    spy = _SpyCanvas()
    draw_signature_block(
        spy,
        config=config,
        signatures=signatures,
        signature_dates=dates,
        anchor_y=500,
        page=page,
        body_font_size=body,
    )
    sizes = [c[2] for c in spy.calls if c[0] == "font"]
    assert sizes
    assert all(size == shared for size in sizes)


def test_slot_geometry_uses_paper_margin_not_page_margin():
    """Khung ký dùng 0.5cm từ mép giấy, không cộng page.margin_left/right."""
    from app.render.signature_block import _slot_geometry

    page = PageMeta(margin_left=90, margin_right=90)
    x0, w0 = _slot_geometry(page, 0, 2, 1)
    x1, w1 = _slot_geometry(page, 1, 2, 1)
    page_width, _ = page_dimensions(page)
    assert abs(x0 - SIGNATURE_BLOCK_MARGIN_PT) < 0.01
    assert abs(x0 + w0 + COLUMN_GAP_PT - x1) < 0.01
    assert abs(x1 + w1 - (page_width - SIGNATURE_BLOCK_MARGIN_PT)) < 0.01
    assert x0 + w0 <= x1 + 0.01


def test_short_text_keeps_body_font_size():
    config = SignatureBlockConfig(
        columns=2,
        slots=[
            SignatureSlot(key="a", label="Người lập", col=0),
            SignatureSlot(key="b", label="Thủ trưởng", col=1),
        ],
    )
    size = shared_signature_font_size(
        config,
        {"a": "A", "b": "B"},
        {},
        PageMeta(),
        body_font_size=12.0,
    )
    assert size == 12.0


def test_row_counts_even_distribution_max_4():
    assert row_counts_for_slots(1) == [1]
    assert row_counts_for_slots(4) == [4]
    assert row_counts_for_slots(5) == [3, 2]
    assert row_counts_for_slots(6) == [3, 3]
    assert row_counts_for_slots(7) == [4, 3]
    assert row_counts_for_slots(8) == [4, 4]
    assert row_counts_for_slots(9) == [3, 3, 3]
    assert row_counts_for_slots(10) == [4, 3, 3]
    assert row_counts_for_slots(11) == [4, 4, 3]
    assert row_counts_for_slots(12) == [4, 4, 4]


def test_layout_evenly_distributes_five_and_ten_slots():
    five = SignatureBlockConfig(
        columns=2,
        slots=[SignatureSlot(key=k, label=k.upper(), col=0) for k in "abcde"],
    )
    placed5 = layout_signature_slots(five)
    assert [(s.key, r, c, n) for s, r, c, n in placed5] == [
        ("a", 0, 0, 3),
        ("b", 0, 1, 3),
        ("c", 0, 2, 3),
        ("d", 1, 0, 2),
        ("e", 1, 1, 2),
    ]

    ten = SignatureBlockConfig(
        columns=4,
        slots=[
            SignatureSlot(key=f"s{i}", label=f"S{i}", col=0) for i in range(10)
        ],
    )
    placed10 = layout_signature_slots(ten)
    assert [n for _, _, _, n in placed10] == [4, 4, 4, 4, 3, 3, 3, 3, 3, 3]
    assert [(r, c) for _, r, c, _ in placed10] == [
        (0, 0),
        (0, 1),
        (0, 2),
        (0, 3),
        (1, 0),
        (1, 1),
        (1, 2),
        (2, 0),
        (2, 1),
        (2, 2),
    ]


def test_many_slots_draw_on_separate_rows_not_overlapping():
    """5 khung → hàng trên 3, hàng dưới 2; không đè y."""
    config = SignatureBlockConfig(
        columns=2,
        gap_pt=40,
        slots=[
            SignatureSlot(key="a", label="Người lập", col=0),
            SignatureSlot(key="b", label="Thủ trưởng", col=1),
            SignatureSlot(key="c", label="Thủ quỹ", col=0),
            SignatureSlot(key="d", label="Kế toán", col=1),
            SignatureSlot(key="e", label="Chủ nhiệm", col=0),
        ],
    )
    spy = _SpyCanvas()
    draw_signature_block(
        spy,
        config=config,
        signatures={"a": "A1", "b": "B1", "c": "C1", "d": "D1", "e": "E1"},
        signature_dates={},
        anchor_y=500,
        page=PageMeta(),
        body_font_size=11.0,
    )
    name_ys = {
        c[1]: c[3]
        for c in spy.calls
        if c[0] == "text" and c[1] in {"A1", "B1", "C1", "D1", "E1"}
    }
    # Hàng 0: a,b,c; hàng 1: d,e
    assert abs(name_ys["A1"] - name_ys["B1"]) < 0.01
    assert abs(name_ys["A1"] - name_ys["C1"]) < 0.01
    assert abs(name_ys["D1"] - name_ys["E1"]) < 0.01
    assert name_ys["A1"] - name_ys["D1"] >= ROW_GAP_PT
    assert signature_block_extra_height(config, body_font_size=11.0) > ROW_GAP_PT


def test_date_line_keeps_titles_horizontally_aligned():
    config = SignatureBlockConfig(
        columns=2,
        gap_pt=40,
        date_line_gap_pt=14,
        slots=[
            SignatureSlot(
                key="a",
                label="Người lập",
                col=0,
                show_date_line=True,
            ),
            SignatureSlot(key="b", label="Thủ trưởng", col=1, show_date_line=False),
        ],
    )
    spy = _SpyCanvas()
    draw_signature_block(
        spy,
        config=config,
        signatures={"a": "A", "b": "B"},
        signature_dates={"a": "Hà Nội, ngày 1 tháng 1 năm 2026"},
        anchor_y=500,
        page=PageMeta(),
    )
    title_ys = [c[3] for c in spy.calls if c[0] == "text" and c[1] in {"NGƯỜI LẬP", "THỦ TRƯỞNG"}]
    assert len(title_ys) == 2
    assert abs(title_ys[0] - title_ys[1]) < 0.01


def test_date_to_title_gap_matches_title_line_height():
    """Khoảng ngày → chức danh = khoảng giữa các dòng chức danh (line_height)."""
    config = SignatureBlockConfig(
        columns=1,
        gap_pt=40,
        date_line_gap_pt=14,  # legacy config — không còn nới khoảng ngày→title
        slots=[
            SignatureSlot(
                key="a",
                label="Dòng 1\nDòng 2",
                col=0,
                show_date_line=True,
            ),
        ],
    )
    spy = _SpyCanvas()
    body = 11.0
    draw_signature_block(
        spy,
        config=config,
        signatures={"a": "Name"},
        signature_dates={"a": "Ngày 01 tháng 06 năm 2026"},
        anchor_y=500,
        page=PageMeta(),
        body_font_size=body,
    )
    font_size = shared_signature_font_size(
        config,
        {"a": "Name"},
        {"a": "Ngày 01 tháng 06 năm 2026"},
        PageMeta(),
        body,
    )
    expected_gap = line_height_for(font_size)
    by_text = {c[1]: c[3] for c in spy.calls if c[0] == "text"}
    date_y = by_text["Ngày 01 tháng 06 năm 2026"]
    title1_y = by_text["DÒNG 1"]
    title2_y = by_text["DÒNG 2"]
    assert abs((date_y - title1_y) - expected_gap) < 0.05
    assert abs((title1_y - title2_y) - expected_gap) < 0.05


def test_date_line_missing_payload_keeps_layout_no_error():
    config = SignatureBlockConfig(
        columns=1,
        gap_pt=40,
        date_line_gap_pt=14,
        slots=[
            SignatureSlot(
                key="nguoi_lap",
                label="Người lập",
                col=0,
                show_date_line=True,
            )
        ],
    )
    assert signature_block_extra_height(config) > 0
    spy = _SpyCanvas()
    draw_signature_block(
        spy,
        config=config,
        signatures={"nguoi_lap": "Nguyễn Văn B"},
        signature_dates={},
        anchor_y=400,
        page=PageMeta(),
    )
    texts = [c[1] for c in spy.calls if c[0] == "text"]
    assert "NGƯỜI LẬP" in texts
    assert "Nguyễn Văn B" in texts
    assert not any("ngày" in t.lower() for t in texts)


def test_title_to_name_gap_equal_across_slots_with_different_title_lines():
    """Khoảng chức danh → tên bằng nhau dù một cột nhiều dòng title hơn."""
    config = SignatureBlockConfig(
        columns=2,
        gap_pt=40,
        slots=[
            SignatureSlot(key="a", label="Người lập", col=0),
            SignatureSlot(key="b", label="Thủ trưởng\nđơn vị", col=1),
        ],
    )
    spy = _SpyCanvas()
    draw_signature_block(
        spy,
        config=config,
        signatures={"a": "Nguyễn A", "b": "Trần B"},
        signature_dates={},
        anchor_y=500,
        page=PageMeta(),
    )
    name_ys = {
        c[1]: c[3]
        for c in spy.calls
        if c[0] == "text" and c[1] in {"Nguyễn A", "Trần B"}
    }
    assert abs(name_ys["Nguyễn A"] - name_ys["Trần B"]) < 0.01


def test_multiline_title_upper_bold_name_preserved():
    config = SignatureBlockConfig(
        columns=1,
        slots=[SignatureSlot(key="nguoi_lap", label="Người lập\nBiên bản", col=0)],
    )
    spy = _SpyCanvas()
    draw_signature_block(
        spy,
        config=config,
        signatures={"nguoi_lap": "Lê C"},
        signature_dates={},
        anchor_y=500,
        page=PageMeta(),
        font_name=FONT_REGULAR,
        font_name_bold=FONT_BOLD,
    )
    texts = [c[1] for c in spy.calls if c[0] == "text"]
    assert texts[0] == "NGƯỜI LẬP"
    assert texts[1] == "BIÊN BẢN"
    assert texts[2] == "Lê C"
    fonts = [c[1] for c in spy.calls if c[0] == "font"]
    assert all(name == FONT_BOLD for name in fonts)


def test_default_signature_block_two_slots():
    config = default_signature_block()
    assert config.columns == 2
    assert len(config.slots) == 2


def test_parse_signature_block_config_from_payload():
    from app.render.signature_block import parse_signature_block_config

    config = parse_signature_block_config(
        {
            "columns": 2,
            "gap_pt": 30,
            "slots": [
                {
                    "key": "a",
                    "label": "Người A",
                    "col": 0,
                    "source": "static",
                    "static_name": "A",
                    "show_date_line": True,
                },
                {"key": "b", "label": "Người B", "col": 1},
            ],
        }
    )
    assert config is not None
    assert config.gap_pt == 30
    assert config.slots[0].static_name == "A"
    assert config.slots[0].show_date_line is True
