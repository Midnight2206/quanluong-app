from __future__ import annotations

from reportlab.pdfbase.pdfmetrics import stringWidth

from app.render.fonts import FONT_BOLD, FONT_ITALIC, FONT_REGULAR
from app.render.text_wrap import line_height_for
from app.template.metadata import (
    FieldMeta,
    PageMeta,
    SignatureBlockConfig,
    SignatureSlot,
)
from app.template.page_size import page_dimensions

SIGNATURE_BLOCK_MARGIN_PT = 0.5 * 28.3465  # 0.5cm ≈ 14.17pt
SLOT_INNER_PAD_PT = 4.0
BASE_TITLE_FONT_SIZE = 11.0
BASE_NAME_FONT_SIZE = 11.0
BASE_DATE_FONT_SIZE = 11.0
MIN_FONT_SIZE_PT = 7.0


def fit_font_size(
    text: str,
    font_name: str,
    max_width_pt: float,
    base_size: float,
    min_size: float = MIN_FONT_SIZE_PT,
) -> float:
    """Giảm font (bước 0.5pt) tới khi vừa max_width; không wrap, không cắt ký tự."""
    raw = "" if text is None else str(text)
    if not raw or max_width_pt <= 0:
        return base_size
    size = float(base_size)
    floor = float(min_size)
    while size > floor and stringWidth(raw, font_name, size) > max_width_pt:
        size = round(size - 0.5, 1)
    return max(size, floor)


def resolve_signature_name(slot: SignatureSlot, signatures: dict[str, str]) -> str:
    if slot.source == "static":
        # Static: luôn dùng static_name — bỏ qua override từ payload.
        return slot.static_name or ""
    return (signatures or {}).get(slot.key, "") or ""


def compute_signature_block_anchor_y(
    table_bottom_y: float,
    extra_fields: list[FieldMeta],
    gap_pt: float = 12,
) -> float:
    """y bắt đầu (đỉnh) khối ký — luôn thấp hơn nội dung phía trên."""
    candidate_ys = [table_bottom_y] + [field.y for field in extra_fields]
    lowest_y = min(candidate_ys)
    return lowest_y - gap_pt


def signature_block_extra_height(
    config: SignatureBlockConfig | None,
    body_font_size: float | None = None,
) -> float:
    """Cộng thêm vào ngân sách pagination nếu có slot bật date_line."""
    if config is None:
        return 0.0
    if not any(slot.show_date_line for slot in config.slots):
        return 0.0
    date_size = float(body_font_size or BASE_DATE_FONT_SIZE)
    return config.date_line_gap_pt + line_height_for(date_size)


def default_signature_block() -> SignatureBlockConfig:
    return SignatureBlockConfig(
        columns=2,
        gap_pt=40,
        slots=[
            SignatureSlot(key="nguoi_lap", label="Người lập", col=0),
            SignatureSlot(key="thu_truong", label="Thủ trưởng đơn vị", col=1),
        ],
    )


def parse_signature_block_config(payload: dict | None) -> SignatureBlockConfig | None:
    """Parse dict từ HTTP body → SignatureBlockConfig. None nếu payload rỗng."""
    if not payload:
        return None
    slots_raw = payload.get("slots") or []
    slots = [
        SignatureSlot(
            key=str(slot.get("key") or "").strip(),
            label=str(slot.get("label") or ""),
            col=int(slot.get("col", 0)),
            col_span=int(slot.get("col_span", 1)),
            source=str(slot.get("source") or "dynamic"),
            static_name=(
                None
                if slot.get("static_name") in (None, "")
                else str(slot.get("static_name"))
            ),
            show_date_line=bool(slot.get("show_date_line", False)),
        )
        for slot in slots_raw
    ]
    return SignatureBlockConfig(
        slots=slots,
        columns=int(payload.get("columns") or max(len(slots), 1)),
        gap_pt=float(payload.get("gap_pt", 40)),
        date_line_gap_pt=float(payload.get("date_line_gap_pt", 14)),
    )


def _slot_geometry(
    page: PageMeta,
    config: SignatureBlockConfig,
    slot: SignatureSlot,
) -> tuple[float, float]:
    page_width, _ = page_dimensions(page)
    usable_left = page.margin_left + SIGNATURE_BLOCK_MARGIN_PT
    usable_width = (
        page_width
        - page.margin_left
        - page.margin_right
        - 2 * SIGNATURE_BLOCK_MARGIN_PT
    )
    col_width = usable_width / max(config.columns, 1)
    x = usable_left + slot.col * col_width
    width = col_width * slot.col_span
    return x, width


def _draw_centered(
    canvas,
    *,
    center_x: float,
    y: float,
    text: str,
    font_name: str,
    font_size: float,
) -> None:
    canvas.setFont(font_name, font_size)
    canvas.drawCentredString(center_x, y, text)


def draw_signature_block(
    canvas,
    config: SignatureBlockConfig,
    signatures: dict[str, str],
    signature_dates: dict[str, str],
    anchor_y: float,
    page: PageMeta,
    font_name: str = FONT_REGULAR,
    font_name_bold: str = FONT_BOLD,
    font_name_italic: str = FONT_ITALIC,
    body_font_size: float | None = None,
) -> None:
    signatures = signatures or {}
    signature_dates = signature_dates or {}
    title_line_height = line_height_for(BASE_TITLE_FONT_SIZE)
    date_base_size = float(body_font_size or BASE_DATE_FONT_SIZE)
    # Nếu bất kỳ slot nào có date line → mọi slot đều chừa cùng band
    # để title luôn nằm ngang bằng nhau.
    any_date_line = any(slot.show_date_line for slot in config.slots)
    date_band = (
        line_height_for(date_base_size) + config.date_line_gap_pt
        if any_date_line
        else 0.0
    )

    for slot in config.slots:
        x, width = _slot_geometry(page, config, slot)
        inner_width = max(width - 2 * SLOT_INNER_PAD_PT, 1.0)
        center_x = x + width / 2
        y = anchor_y

        if any_date_line:
            if slot.show_date_line:
                # Ngày tháng: italic, cùng size dòng dữ liệu (có thể shrink nếu dài).
                date_text = signature_dates.get(slot.key, "") or ""
                date_size = fit_font_size(
                    date_text, font_name_italic, inner_width, date_base_size
                )
                if date_text:
                    _draw_centered(
                        canvas,
                        center_x=center_x,
                        y=y - date_size,
                        text=date_text,
                        font_name=font_name_italic,
                        font_size=date_size,
                    )
            y -= date_band

        title_lines = (slot.label or "").split("\n")
        for line in title_lines:
            display = line.upper()
            size = fit_font_size(
                display, font_name_bold, inner_width, BASE_TITLE_FONT_SIZE
            )
            _draw_centered(
                canvas,
                center_x=center_x,
                y=y - size,
                text=display,
                font_name=font_name_bold,
                font_size=size,
            )
            y -= title_line_height

        y -= config.gap_pt

        name = resolve_signature_name(slot, signatures)
        if name:
            name_size = fit_font_size(
                name, font_name_bold, inner_width, BASE_NAME_FONT_SIZE
            )
            _draw_centered(
                canvas,
                center_x=center_x,
                y=y - name_size,
                text=name,
                font_name=font_name_bold,
                font_size=name_size,
            )


__all__ = [
    "BASE_DATE_FONT_SIZE",
    "BASE_NAME_FONT_SIZE",
    "BASE_TITLE_FONT_SIZE",
    "MIN_FONT_SIZE_PT",
    "SIGNATURE_BLOCK_MARGIN_PT",
    "SLOT_INNER_PAD_PT",
    "compute_signature_block_anchor_y",
    "default_signature_block",
    "draw_signature_block",
    "fit_font_size",
    "parse_signature_block_config",
    "resolve_signature_name",
    "signature_block_extra_height",
]
