"""Sổ nhập xuất LTTP — A4 dọc. Node đã cắt trang (splitLedgerPages); file này chỉ vẽ.

Thứ tự: bìa, rồi từng ngày trang trái (A–K) rồi trang phải (L–U). Không chèn trang trắng.
`tail` khác null là móc đuôi sổ (biên bản tịnh kho + báo cáo công khai I–VII), chưa vẽ nội dung đó.
"""

from __future__ import annotations

from io import BytesIO

from reportlab.lib.colors import Color, black
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from app.render.fonts import FONT_BOLD, FONT_BOLD_ITALIC, FONT_REGULAR
from app.render.signature_block import draw_signature_block
from app.template.metadata import PageMeta, SignatureBlockConfig, SignatureSlot

PAGE = PageMeta(
    page_size="A4",
    orientation="portrait",
    margin_top=22,
    margin_right=31,
    margin_bottom=22,
    margin_left=31,
)
HEADER_ROWS = 5
HEADER_H = 54
ROW_H = 12
FONT_DATA = 7
FONT_HEAD = 6.5

# Cột A–K và L–U. Rộng tương đối; render co cho vừa khổ in.
LEFT_WIDTHS = [16, 200, 26, 44, 30, 52, 28, 26, 28, 26, 50]
RIGHT_WIDTHS = [30, 52, 30, 52, 30, 52, 30, 52, 108, 97]
LEFT_KEYS = [
    "stt", "name", "uom", "price", "openingQty", "openingAmount",
    "inG", "inH", "inI", "inJ", "inAmount",
]
RIGHT_KEYS = [
    "totalInQty", "totalInAmount", "mealQty", "mealAmount",
    "otherQty", "otherAmount", "totalOutQty", "totalOutAmount",
]
LEFT_MONEY = {5: "openingAmount", 10: "inAmount"}
RIGHT_MONEY = {1: "totalInAmount", 3: "mealAmount", 5: "otherAmount", 7: "totalOutAmount"}
LEFT_ALIGN = {"name": "left", "openingAmount": "right", "inAmount": "right", "price": "right"}
RIGHT_ALIGN = {
    "totalInAmount": "right", "mealAmount": "right",
    "otherAmount": "right", "totalOutAmount": "right",
}

# (cột, hàng, colspan, rowspan, chữ) — tiêu đề lặp mỗi trang, dòng 2–6 của mẫu.
LEFT_HEADER = [
    (0, 0, 1, 5, "TT"),
    (1, 0, 1, 5, "Tên LTTP-Chất đốt"),
    (2, 0, 1, 5, "ĐVT"),
    (3, 0, 1, 5, "Đơn giá"),
    (4, 0, 2, 1, "Ngày trước\nchuyển qua"),
    (6, 0, 5, 1, "Nhập trong ngày"),
    (4, 1, 1, 4, "Số\nlượng"),
    (5, 1, 1, 4, "Thành\ntiền"),
    (6, 1, 4, 1, "Số lượng"),
    (10, 1, 1, 4, "Thành\ntiền"),
    (6, 2, 2, 1, "Trên BĐ"),
    (8, 2, 2, 1, "Đơn vị BĐ"),
    (6, 3, 1, 2, "Mua TT"),
    (7, 3, 1, 1, "TG"),
    (8, 3, 1, 2, "Mua TT"),
    (9, 3, 1, 1, "TG"),
    (7, 4, 1, 1, "CB"),
    (9, 4, 1, 1, "CB"),
]
RIGHT_HEADER = [
    (0, 0, 2, 1, "Cộng nhập"),
    (2, 0, 2, 1, "Xuất ăn\ntrong ngày"),
    (4, 0, 2, 1, "Xuất khác"),
    (6, 0, 2, 1, "Cộng xuất"),
    (8, 0, 2, 1, "CÔNG KHAI\nTÀI CHÍNH"),
    (0, 1, 1, 4, "Số\nlượng"),
    (1, 1, 1, 4, "Thành\ntiền"),
    (2, 1, 1, 4, "Số\nlượng"),
    (3, 1, 1, 4, "Thành\ntiền"),
    (4, 1, 1, 4, "Số\nlượng"),
    (5, 1, 1, 4, "Thành\ntiền"),
    (6, 1, 1, 4, "Số\nlượng"),
    (7, 1, 1, 4, "Thành\ntiền"),
    (8, 2, 2, 3, ""),
]


def _fit_widths(widths: list[float], total: float) -> list[float]:
    raw = sum(widths) or 1
    scaled = [w * total / raw for w in widths[:-1]]
    scaled.append(total - sum(scaled))
    return scaled


def _fit_size(text: str, font: str, size: float, width: float) -> float:
    fitted = size
    while fitted > 4.5 and stringWidth(text, font, fitted) > width:
        fitted -= 0.25
    return fitted


def _draw_cell(c, x, y_top, w, h, text, font, size, align="center") -> None:
    c.setStrokeColor(black)
    c.setFillColor(black)
    c.setLineWidth(0.3)
    c.rect(x, y_top - h, w, h, stroke=1, fill=0)
    raw = "" if text is None else str(text)
    if not raw:
        return
    lines = raw.split("\n")
    inner = max(w - 3, 4)
    fitted = min(_fit_size(line, font, size, inner) for line in lines)
    c.setFont(font, fitted)
    line_h = fitted + 1.1
    block = line_h * len(lines)
    baseline = y_top - (h - block) / 2 - fitted
    for index, line in enumerate(lines):
        yy = baseline - index * line_h
        if align == "left":
            c.drawString(x + 1.5, yy, line)
        elif align == "right":
            c.drawRightString(x + w - 1.5, yy, line)
        else:
            c.drawCentredString(x + w / 2, yy, line)


def _span_box(widths, col, span):
    x = sum(widths[:col])
    w = sum(widths[col:col + span])
    return x, w


def _layout(book):
    layout = book.get("layout") if isinstance(book, dict) else None
    return layout if isinstance(layout, dict) else {}


def _header_rows(book) -> int:
    count = _layout(book).get("headerRowCount")
    return int(count) if count else HEADER_ROWS


def _font_data(book) -> float:
    size = _layout(book).get("fontData")
    return float(size) if size else FONT_DATA


def _side_header(book, side, date_line):
    layout = _layout(book)
    key = "leftHeader" if side == "left" else "rightHeader"
    cells = layout.get(key)
    if not cells:
        if side == "left":
            return LEFT_HEADER
        return list(RIGHT_HEADER) + [(8, 1, 2, 1, date_line or "Ngày")]
    header = [tuple(cell) for cell in cells]
    if side == "right":
        slot = layout.get("dateCell") or [8, 1, 2, 1]
        header.append((int(slot[0]), int(slot[1]), int(slot[2]), int(slot[3]), date_line or "Ngày"))
    return header


def _draw_header(c, origin_x, y_top, widths, cells, header_rows=HEADER_ROWS) -> float:
    band = HEADER_H / header_rows
    for col, row, span, rows, text in cells:
        x, w = _span_box(widths, col, span)
        _draw_cell(
            c, origin_x + x, y_top - row * band, w, band * rows,
            text, FONT_BOLD, FONT_HEAD,
        )
    return y_top - HEADER_H


def _draw_data_row(c, origin_x, y_top, widths, keys, aligns, values, font, font_size=FONT_DATA) -> float:
    x = origin_x
    for key, width in zip(keys, widths):
        align = aligns.get(key, "center")
        if key == "name":
            align = "left"
        _draw_cell(c, x, y_top, width, ROW_H, values.get(key, ""), font, font_size, align)
        x += width
    return y_top - ROW_H


def _money_row(c, origin_x, y_top, widths, keys, money_map, label, values, label_index) -> float:
    x = origin_x
    for index, (_key, width) in enumerate(zip(keys, widths)):
        field = money_map.get(index)
        if field:
            _draw_cell(
                c, x, y_top, width, ROW_H, values.get(field, ""),
                FONT_BOLD_ITALIC, FONT_DATA, "right",
            )
        elif index == label_index:
            _draw_cell(c, x, y_top, width, ROW_H, label, FONT_BOLD_ITALIC, 6.5, "left")
        else:
            _draw_cell(c, x, y_top, width, ROW_H, "", FONT_REGULAR, FONT_DATA)
        x += width
    return y_top - ROW_H


def _watermark(c, page_w, page_h) -> None:
    c.saveState()
    c.setFillColor(Color(0.72, 0.72, 0.72))
    c.setFont(FONT_BOLD, 64)
    c.translate(page_w / 2, page_h / 2)
    c.rotate(35)
    c.drawCentredString(0, 0, "NHÁP")
    c.restoreState()
    c.setFillColor(black)
    c.setFont(FONT_BOLD, 9)
    c.drawString(PAGE.margin_left, page_h - 14, "NHÁP")


def _slots(pairs: list[tuple[str, str]]) -> SignatureBlockConfig:
    return SignatureBlockConfig(
        slots=[
            SignatureSlot(key=key, label=label, col=index, col_span=1)
            for index, (key, label) in enumerate(pairs)
        ],
        columns=len(pairs),
        gap_pt=46,
    )


def _draw_signatures(c, anchor_y, pairs, book) -> None:
    if anchor_y < PAGE.margin_bottom + 70:
        anchor_y = PAGE.margin_bottom + 96
    draw_signature_block(
        c,
        _slots(pairs),
        book.get("signatures") or {},
        {},
        anchor_y,
        PAGE,
        body_font_size=8,
        signature_images=book.get("signatureImages") or {},
        signature_image_layout=book.get("signatureImageLayout"),
    )


def _wrap(text: str, font: str, size: float, width: float) -> list[str]:
    words = str(text).split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = word if not current else f"{current} {word}"
        if stringWidth(trial, font, size) <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def _draw_cover(c, book, page_w, page_h) -> None:
    cover = book.get("cover") or {}
    width = page_w - PAGE.margin_left - PAGE.margin_right
    commander = cover.get("commander") or ""
    keeper = cover.get("keeper") or ""
    paragraphs = [
        (FONT_REGULAR, 13, f"Chỉ huy đơn vị: {commander} chứng nhận".strip()),
        (FONT_REGULAR, 13, (
            f"Giao sổ này cho đồng chí: {keeper} – Nhân viên quản lý để làm sổ nhập – xuất "
            "lương thực, thực phẩm, chất đốt, tiền ăn hằng ngày, hằng tháng của bộ đội "
            "và công khai trước đơn vị"
        )),
        (FONT_REGULAR, 13, cover.get("dateLine") or ""),
    ]
    wrapped = []
    for font, size, text in paragraphs:
        wrapped.append((font, size, _wrap(text, font, size, width - 36)))
    draft_days = cover.get("draftDays") or []
    warning = ""
    if draft_days:
        shown = ", ".join(day[8:10] + "/" + day[5:7] for day in draft_days if len(day) >= 10)
        warning = f"Chưa chốt, trang các ngày sau in NHÁP: {shown}"
    line_h = 16
    block = sum(len(lines) * line_h + 8 for _, _, lines in wrapped)
    if warning:
        block += 28
    y = page_h / 2 + block / 2
    if cover.get("unitName"):
        c.setFont(FONT_BOLD, 12)
        c.drawCentredString(page_w / 2, y + 28, str(cover["unitName"]))
    for font, size, lines in wrapped:
        c.setFont(font, size)
        for line in lines:
            c.drawCentredString(page_w / 2, y, line)
            y -= line_h
        y -= 8
    _draw_signatures(c, y, [("chi_huy", "Chỉ huy đơn vị")], book)
    if warning:
        c.setFillColor(Color(0.55, 0.1, 0.1))
        c.setFont(FONT_BOLD, 10)
        warn_y = PAGE.margin_bottom + 40
        for line in _wrap(warning, FONT_BOLD, 10, width - 20):
            c.drawCentredString(page_w / 2, warn_y, line)
            warn_y -= 12
        c.setFillColor(black)


def _draw_finance(c, x, y_top, width, lines) -> float:
    if not lines:
        return y_top
    label_w = width * 0.48
    value_w = width - label_w
    y = y_top
    for row in lines:
        _draw_cell(c, x, y, label_w, ROW_H, row.get("label", ""), FONT_REGULAR, 6.2, "left")
        _draw_cell(c, x + label_w, y, value_w, ROW_H, row.get("value", ""), FONT_REGULAR, 6.2, "right")
        y -= ROW_H
    return y


def _draw_side(c, book, day, sheet, side, page_w, page_h) -> None:
    if day.get("draft"):
        _watermark(c, page_w, page_h)
    content_w = page_w - PAGE.margin_left - PAGE.margin_right
    left = side == "left"
    widths = _fit_widths(LEFT_WIDTHS if left else RIGHT_WIDTHS, content_w if left else content_w)
    y = page_h - PAGE.margin_top
    c.setFillColor(black)
    c.setFont(FONT_REGULAR, 8)
    if left:
        c.drawString(PAGE.margin_left, y, day.get("dateLine") or "")
    else:
        c.drawRightString(page_w - PAGE.margin_right, y, "ĐVT: Đồng")
    y -= 12
    header_rows = _header_rows(book)
    font_size = _font_data(book)
    if left:
        y = _draw_header(c, PAGE.margin_left, y, widths, _side_header(book, "left", day.get("dateLine")), header_rows)
    else:
        y = _draw_header(c, PAGE.margin_left, y, widths, _side_header(book, "right", day.get("dateLine")), header_rows)
    keys = LEFT_KEYS if left else RIGHT_KEYS
    aligns = LEFT_ALIGN if left else RIGHT_ALIGN
    money_map = LEFT_MONEY if left else RIGHT_MONEY
    label_index = 1 if left else 0
    if sheet.get("carryIn"):
        y = _money_row(
            c, PAGE.margin_left, y, widths, keys, money_map, "Mang sang", sheet["carryIn"], label_index,
        )
    for row in sheet.get("rows") or []:
        y = _draw_data_row(c, PAGE.margin_left, y, widths, keys, aligns, row, FONT_REGULAR, font_size)
    if day.get("note") and not sheet.get("rows"):
        y = _draw_data_row(
            c, PAGE.margin_left, y, widths, keys, aligns,
            {"name": day["note"]} if left else {"totalInQty": day["note"]},
            FONT_BOLD,
        )
    if sheet.get("carryOut"):
        y = _money_row(
            c, PAGE.margin_left, y, widths, keys, money_map, "Cộng sang trang", sheet["carryOut"], label_index,
        )
    if sheet.get("showTotal"):
        y = _money_row(
            c, PAGE.margin_left, y, widths, keys, money_map, "Cộng", sheet.get("totals") or {}, label_index,
        )
    finance_bottom = y
    if not left:
        finance_w = widths[-2] + widths[-1]
        finance_x = PAGE.margin_left + sum(widths[:-2])
        finance_top = y + ROW_H * (
            (1 if sheet.get("carryIn") else 0)
            + len(sheet.get("rows") or [])
            + (1 if day.get("note") and not sheet.get("rows") else 0)
            + (1 if sheet.get("carryOut") else 0)
            + (1 if sheet.get("showTotal") else 0)
        )
        # Khối tài chính nằm cạnh các dòng hàng, không tính lại số.
        finance_bottom = _draw_finance(c, finance_x, finance_top, finance_w, day.get("financeLines") or [])
    if sheet.get("showSignature"):
        bottom = min(y, finance_bottom)
        pairs = [("quan_ly", "Quản lý đơn vị"), ("truc_ban", "Trực ban")] if left else [("chi_huy", "Chỉ huy đơn vị\n(đóng dấu)")]
        _draw_signatures(c, bottom - 8, pairs, book)


def _draw_tail(c, tail, page_w, page_h) -> None:
    # ponytail: nội dung đuôi sổ chưa làm. Có payload là thêm một trang để móc sau.
    c.setFont(FONT_BOLD, 14)
    title = ""
    if isinstance(tail, dict):
        title = str(tail.get("title") or "")
    c.drawCentredString(page_w / 2, page_h / 2, title or "Đuôi sổ")


def render_kitchen_ledger_book(book: dict) -> bytes:
    if not isinstance(book, dict) or not isinstance(book.get("days"), list):
        raise ValueError("Thiếu danh sách ngày của sổ")
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setTitle("Sổ nhập xuất LTTP")
    page_w, page_h = A4
    _draw_cover(c, book, page_w, page_h)
    for day in book["days"]:
        for sheet in day.get("sheets") or []:
            c.showPage()
            _draw_side(c, book, day, sheet, "left", page_w, page_h)
            c.showPage()
            _draw_side(c, book, day, sheet, "right", page_w, page_h)
    tail = book.get("tail")
    if tail:
        c.showPage()
        _draw_tail(c, tail, page_w, page_h)
    c.save()
    return buffer.getvalue()


__all__ = ["render_kitchen_ledger_book"]
