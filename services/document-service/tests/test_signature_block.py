from reportlab.pdfbase.pdfmetrics import stringWidth

import pytest

from app.render.fonts import FONT_BOLD, FONT_REGULAR
from app.render.signature_block import (
    MIN_FONT_SIZE_PT,
    compute_signature_block_anchor_y,
    default_signature_block,
    draw_signature_block,
    fit_font_size,
    resolve_signature_name,
    signature_block_extra_height,
)
from app.template.metadata import FieldMeta, PageMeta, SignatureBlockConfig, SignatureSlot


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
