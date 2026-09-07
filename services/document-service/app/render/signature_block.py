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

# Margin riêng khung ký so với mép giấy (không cộng margin page content).
SIGNATURE_BLOCK_MARGIN_PT = 0.5 * 28.3465  # 0.5cm ≈ 14.17pt
# Khoảng trống ngang giữa các cột khung ký (tránh chữ tràn nhìn như đè).
COLUMN_GAP_PT = 8.0
# Khoảng trống dọc giữa các hàng khung ký khi wrap.
ROW_GAP_PT = 16.0
SLOT_INNER_PAD_PT = 4.0
BASE_TITLE_FONT_SIZE = 11.0
BASE_NAME_FONT_SIZE = 11.0
BASE_DATE_FONT_SIZE = 11.0
MIN_FONT_SIZE_PT = 7.0
# Font khung ký nhỏ nhất = body − 2pt.
BODY_FONT_SHRINK_MAX_PT = 2.0
# Tối đa khung ký trên một hàng; dư thì chia đều xuống hàng.
MAX_SIGNATURE_COLS_PER_ROW = 4


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


def row_counts_for_slots(
    n: int,
    max_per_row: int = MAX_SIGNATURE_COLS_PER_ROW,
) -> list[int]:
    """Chia đều số khung/hàng; tối đa max_per_row; dư ưu tiên hàng trên.

    Ví dụ (max=4): 5→[3,2], 9→[3,3,3], 10→[4,3,3].
    """
    if n <= 0:
        return []
    limit = max(int(max_per_row), 1)
    if n <= limit:
        return [n]
    rows = (n + limit - 1) // limit
    base = n // rows
    rem = n % rows
    return [base + 1 if i < rem else base for i in range(rows)]


def layout_signature_slots(
    config: SignatureBlockConfig,
) -> list[tuple[SignatureSlot, int, int, int]]:
    """Xếp slot theo lưới chia đều — tối đa 4/hàng.

    Trả về (slot, row, col, row_col_count). Bỏ qua slot.col cấu hình
    (tránh đè khi nhiều slot cùng col); mỗi hàng dùng width theo số cột hàng đó.
    """
    counts = row_counts_for_slots(len(config.slots))
    placed: list[tuple[SignatureSlot, int, int, int]] = []
    index = 0
    for row, count in enumerate(counts):
        for col in range(count):
            placed.append((config.slots[index], row, col, count))
            index += 1
    return placed


def _row_count(placed: list[tuple[SignatureSlot, int, int, int]]) -> int:
    if not placed:
        return 0
    return max(row for _, row, _, _ in placed) + 1


def _one_row_content_height(
    config: SignatureBlockConfig,
    font_size: float,
) -> float:
    """Chiều cao một hàng khung ký (date + title + gap tên + tên)."""
    title_lines = max(
        (len((slot.label or "").split("\n")) for slot in config.slots),
        default=1,
    )
    lh = line_height_for(font_size)
    title_band = max(1, title_lines) * lh
    # Ngày → chức danh: cùng line_height như giữa các dòng title (không cộng date_line_gap_pt).
    date_band = lh if any(slot.show_date_line for slot in config.slots) else 0.0
    return date_band + title_band + config.gap_pt + lh


def signature_block_extra_height(
    config: SignatureBlockConfig | None,
    body_font_size: float | None = None,
) -> float:
    """Cộng thêm pagination: date line + các hàng wrap thêm."""
    if config is None or not config.slots:
        return 0.0
    font_size = float(body_font_size or BASE_DATE_FONT_SIZE)
    placed = layout_signature_slots(config)
    rows = _row_count(placed)
    extra = 0.0
    if any(slot.show_date_line for slot in config.slots):
        extra += line_height_for(font_size)
    # Hàng 1 đã nằm trong signature_block_height_pt của template;
    # chỉ cộng thêm hàng 2+.
    if rows > 1:
        row_h = _one_row_content_height(config, font_size)
        extra += (rows - 1) * (row_h + ROW_GAP_PT)
    return extra


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
                None if slot.get("static_name") is None else str(slot.get("static_name"))
            ),
            show_date_line=bool(slot.get("show_date_line", False)),
        )
        for slot in slots_raw
    ]
    return SignatureBlockConfig(
        slots=slots,
        columns=int(payload.get("columns") or max(len(slots), 1)),
        gap_pt=float(payload.get("gap_pt", 40)),
        date_line_gap_pt=float(payload.get("date_line_gap_pt", 0)),
    )


def _slot_geometry(
    page: PageMeta,
    layout_col: int,
    row_col_count: int,
    col_span: int = 1,
) -> tuple[float, float]:
    """x, width của cột ký — mép trái/phải = 0.5cm từ giấy; gap ngang giữa cột."""
    page_width, _ = page_dimensions(page)
    usable_left = SIGNATURE_BLOCK_MARGIN_PT
    usable_width = max(page_width - 2 * SIGNATURE_BLOCK_MARGIN_PT, 1.0)
    col_count = max(int(row_col_count), 1)
    span = max(1, min(int(col_span or 1), col_count))
    gaps_total = COLUMN_GAP_PT * max(col_count - 1, 0)
    col_width = (usable_width - gaps_total) / col_count
    x = usable_left + layout_col * (col_width + COLUMN_GAP_PT)
    width = col_width * span + COLUMN_GAP_PT * max(span - 1, 0)
    return x, width


def _slot_inner_width(width: float) -> float:
    return max(width - 2 * SLOT_INNER_PAD_PT, 1.0)


def _collect_fit_candidates(
    config: SignatureBlockConfig,
    signatures: dict[str, str],
    signature_dates: dict[str, str],
    page: PageMeta,
    font_name_bold: str,
    font_name_italic: str,
) -> list[tuple[str, str, float]]:
    """(text, font_name, max_width) cho mọi dòng chức danh / tên / ngày mọi khung."""
    candidates: list[tuple[str, str, float]] = []
    for slot, _row, layout_col, row_cols in layout_signature_slots(config):
        _, width = _slot_geometry(page, layout_col, row_cols, 1)
        inner_width = _slot_inner_width(width)
        for line in (slot.label or "").split("\n"):
            display = line.upper().strip()
            if display:
                candidates.append((display, font_name_bold, inner_width))
        name = resolve_signature_name(slot, signatures)
        if name:
            candidates.append((name, font_name_bold, inner_width))
        if slot.show_date_line:
            date_text = signature_dates.get(slot.key, "") or ""
            if date_text:
                candidates.append((date_text, font_name_italic, inner_width))
    return candidates


def shared_signature_font_size(
    config: SignatureBlockConfig,
    signatures: dict[str, str],
    signature_dates: dict[str, str],
    page: PageMeta,
    body_font_size: float,
    font_name_bold: str = FONT_BOLD,
    font_name_italic: str = FONT_ITALIC,
) -> float:
    """Một size chung: bắt đầu từ body, co theo phần dài nhất, sàn = body − 2pt."""
    base = float(body_font_size)
    floor = max(base - BODY_FONT_SHRINK_MAX_PT, 1.0)
    size = base
    for text, font_name, max_width in _collect_fit_candidates(
        config,
        signatures,
        signature_dates,
        page,
        font_name_bold,
        font_name_italic,
    ):
        size = min(
            size,
            fit_font_size(text, font_name, max_width, base, min_size=floor),
        )
    return size


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
    body_size = float(body_font_size or BASE_TITLE_FONT_SIZE)
    font_size = shared_signature_font_size(
        config,
        signatures,
        signature_dates,
        page,
        body_size,
        font_name_bold=font_name_bold,
        font_name_italic=font_name_italic,
    )
    title_line_height = line_height_for(font_size)
    any_date_line = any(slot.show_date_line for slot in config.slots)
    # Cùng khoảng dòng với chức danh đa dòng — không cộng date_line_gap_pt.
    date_band = title_line_height if any_date_line else 0.0
    max_title_lines = max(
        (len((slot.label or "").split("\n")) for slot in config.slots),
        default=1,
    )
    title_band = max(1, max_title_lines) * title_line_height
    row_height = _one_row_content_height(config, font_size)
    placed = layout_signature_slots(config)

    for slot, row, layout_col, row_cols in placed:
        x, width = _slot_geometry(page, layout_col, row_cols, 1)
        center_x = x + width / 2
        y = anchor_y - row * (row_height + ROW_GAP_PT)

        if any_date_line:
            if slot.show_date_line:
                date_text = signature_dates.get(slot.key, "") or ""
                if date_text:
                    _draw_centered(
                        canvas,
                        center_x=center_x,
                        y=y - font_size,
                        text=date_text,
                        font_name=font_name_italic,
                        font_size=font_size,
                    )
            y -= date_band

        title_top = y
        title_lines = (slot.label or "").split("\n")
        for index, line in enumerate(title_lines):
            display = line.upper()
            _draw_centered(
                canvas,
                center_x=center_x,
                y=title_top - index * title_line_height - font_size,
                text=display,
                font_name=font_name_bold,
                font_size=font_size,
            )

        name_y = title_top - title_band - config.gap_pt
        name = resolve_signature_name(slot, signatures)
        if name:
            _draw_centered(
                canvas,
                center_x=center_x,
                y=name_y - font_size,
                text=name,
                font_name=font_name_bold,
                font_size=font_size,
            )


__all__ = [
    "BASE_DATE_FONT_SIZE",
    "BASE_NAME_FONT_SIZE",
    "BASE_TITLE_FONT_SIZE",
    "BODY_FONT_SHRINK_MAX_PT",
    "COLUMN_GAP_PT",
    "MAX_SIGNATURE_COLS_PER_ROW",
    "MIN_FONT_SIZE_PT",
    "ROW_GAP_PT",
    "SIGNATURE_BLOCK_MARGIN_PT",
    "SLOT_INNER_PAD_PT",
    "compute_signature_block_anchor_y",
    "default_signature_block",
    "draw_signature_block",
    "fit_font_size",
    "layout_signature_slots",
    "parse_signature_block_config",
    "resolve_signature_name",
    "row_counts_for_slots",
    "shared_signature_font_size",
    "signature_block_extra_height",
]
