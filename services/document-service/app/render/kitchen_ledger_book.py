"""Sổ nhập xuất LTTP — A4 dọc, số đo đã gồm tỉ lệ in 97 %.

Node cắt trang (splitLedgerPages). File này chỉ vẽ cho khớp mẫu
docs/print-templates. Đuôi sổ 9 trang chưa vẽ: `tail` khác null chỉ thêm một trang móc.
"""

from __future__ import annotations

from io import BytesIO

from reportlab.lib.colors import Color, black
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from app.render.fonts import FONT_BOLD, FONT_BOLD_ITALIC, FONT_ITALIC, FONT_REGULAR

ROW_H = 14.55
HEADER_HS = [31.2, 14.55, 14.55, 14.55, 14.55]
HEADER_H = sum(HEADER_HS)
FIRST_TOP = 57.7
NEXT_TOP = 43.1
MIN_FIRST_ROWS = 28
THIN = 0.73
HAIR = 0.1
LEFT_X = 31.2
LEFT_WIDTHS = [24.5, 159.3, 26.3, 42.5, 31.6, 58.6, 35.3, 35.3, 32.8, 32.9, 53.2]
RIGHT_WIDTHS = [32.8, 52.0, 33.5, 53.2, 31.6, 32.9, 31.6, 52.1, 95.0, 114.3]
LEFT_SPEC = [
    ("stt", "center", 12),
    ("name", "left", 12),
    ("uom", "center", 12),
    ("price", "right", 11),
    ("openingQty", "center", 11),
    ("openingAmount", "right", 11),
    ("inG", "center", 11),
    ("inH", "center", 11),
    ("inI", "center", 11),
    ("inJ", "center", 11),
    ("inAmount", "right", 10),
]
RIGHT_SPEC = [
    ("totalInQty", "center", 10),
    ("totalInAmount", "right", 10),
    ("mealQty", "center", 11),
    ("mealAmount", "right", 11),
    ("otherQty", "center", 11),
    ("otherAmount", "right", 11),
    ("totalOutQty", "center", 11),
    ("totalOutAmount", "right", 11),
]
LEFT_MONEY = {5, 10}
RIGHT_MONEY = {1, 3, 5, 7}
# Mốc trong cột U, đo trên PDF mẫu.
U_COUNT_RIGHT = 11.7
U_X = 14.6
U_PRICE = 23.3
U_EQ = 58.1
U_AMOUNT_RIGHT = 114.0


def _xs(widths: list[float]) -> list[float]:
    points = [LEFT_X]
    for width in widths:
        points.append(round(points[-1] + width, 4))
    return points


def _size(nominal: float) -> float:
    return nominal * 0.97


def _hline(c, x0, x1, top, page_h, width) -> None:
    y = page_h - top
    c.setStrokeColor(black)
    c.setLineWidth(width)
    c.line(x0, y, x1, y)


def _vlines(c, xs, top, bottom, page_h, skip=()) -> None:
    c.setStrokeColor(black)
    c.setLineWidth(THIN)
    y0 = page_h - bottom
    y1 = page_h - top
    for index, x in enumerate(xs):
        if index in skip:
            continue
        c.line(x, y0, x, y1)


def _baseline(top, height, size, page_h, lines=1) -> float:
    line_h = size + 1.15
    block = line_h * lines
    first = top + height / 2 - block / 2 + size * 0.78
    return page_h - first


def _text(c, x, top, width, height, text, font, nominal, align, page_h) -> None:
    raw = "" if text is None else str(text)
    if not raw:
        return
    size = _size(nominal)
    lines = raw.split("\n")
    c.setFillColor(black)
    c.setFont(font, size)
    line_h = size + 1.15
    for index, line in enumerate(lines):
        baseline = _baseline(top, height, size, page_h, len(lines)) - index * line_h
        if align == "left":
            c.drawString(x + 1.5, baseline, line)
        elif align == "right":
            c.drawRightString(x + width - 1.3, baseline, line)
        else:
            c.drawCentredString(x + width / 2, baseline, line)


def _span(xs, col, span):
    return xs[col], xs[col + span] - xs[col]


def _header_texts(side, date_line):
    if side == "left":
        return [
            (0, 0, 1, 5, "TT", FONT_BOLD, 12),
            (1, 0, 1, 5, "Tên LTTP-Chất đốt", FONT_BOLD, 11),
            (2, 0, 1, 5, "ĐVT", FONT_BOLD, 10),
            (3, 0, 1, 5, "Đơn giá", FONT_BOLD, 10),
            (4, 0, 2, 1, "Ngày trước\nchuyển qua", FONT_BOLD, 12),
            (6, 0, 5, 1, "Nhập trong ngày", FONT_BOLD, 12),
            (4, 1, 1, 4, "Số\nlượng", FONT_BOLD, 10),
            (5, 1, 1, 4, "Thành tiền", FONT_BOLD, 10),
            (6, 1, 4, 1, "Số lượng", FONT_BOLD, 12),
            (10, 1, 1, 4, "Thành\ntiền", FONT_BOLD, 10),
            (6, 2, 2, 1, "Trên BĐ", FONT_BOLD, 10),
            (8, 2, 2, 1, "Đơn vị BĐ", FONT_BOLD, 10),
            (6, 3, 1, 2, "Mua\nTT", FONT_BOLD, 10),
            (8, 3, 1, 2, "Mua\nTT", FONT_BOLD, 10),
            (7, 3, 1, 1, "TG", FONT_BOLD, 10),
            (9, 3, 1, 1, "TG", FONT_BOLD, 10),
            (7, 4, 1, 1, "CB", FONT_BOLD, 10),
            (9, 4, 1, 1, "CB", FONT_BOLD, 10),
        ]
    return [
        (0, 0, 2, 1, "Cộng nhập", FONT_BOLD, 12),
        (2, 0, 2, 1, "Xuất ăn\ntrong ngày", FONT_BOLD, 12),
        (4, 0, 2, 1, "Xuất khác", FONT_BOLD, 12),
        (6, 0, 2, 1, "Cộng xuất", FONT_BOLD, 12),
        (8, 0, 2, 1, "CÔNG KHAI TÀI CHÍNH", FONT_BOLD, 12),
        (0, 1, 1, 4, "Số\nlượng", FONT_BOLD, 10),
        (1, 1, 1, 4, "Thành tiền", FONT_BOLD, 10),
        (2, 1, 1, 4, "Số\nlượng", FONT_BOLD, 10),
        (3, 1, 1, 4, "Thành tiền", FONT_BOLD, 10),
        (4, 1, 1, 4, "Số\nlượng", FONT_BOLD, 10),
        (5, 1, 1, 4, "Thành\ntiền", FONT_BOLD, 10),
        (6, 1, 1, 4, "Số\nlượng", FONT_BOLD, 10),
        (7, 1, 1, 4, "Thành tiền", FONT_BOLD, 10),
        (8, 1, 2, 1, date_line or "", FONT_BOLD, 12),
    ]


def _header_merges(side):
    """Ô gộp tiêu đề: chỉ viền ngoài, không có đường kẻ bên trong."""
    if side == "left":
        return [
            ("TT", 0, 0, 1, 5),
            ("Tên LTTP-Chất đốt", 1, 0, 1, 5),
            ("ĐVT", 2, 0, 1, 5),
            ("Đơn giá", 3, 0, 1, 5),
            ("Ngày trước chuyển qua", 4, 0, 2, 1),
            ("Nhập trong ngày", 6, 0, 5, 1),
            ("Số lượng tồn", 4, 1, 1, 4),
            ("Thành tiền tồn", 5, 1, 1, 4),
            ("Số lượng nhập", 6, 1, 4, 1),
            ("Thành tiền nhập", 10, 1, 1, 4),
            ("Trên BĐ", 6, 2, 2, 1),
            ("Đơn vị BĐ", 8, 2, 2, 1),
            ("Mua TT trên", 6, 3, 1, 2),
            ("TG CB trên", 7, 3, 1, 2),
            ("Mua TT đơn vị", 8, 3, 1, 2),
            ("TG CB đơn vị", 9, 3, 1, 2),
        ]
    return [
        ("Cộng nhập", 0, 0, 2, 1),
        ("Xuất ăn trong ngày", 2, 0, 2, 1),
        ("Xuất khác", 4, 0, 2, 1),
        ("Cộng xuất", 6, 0, 2, 1),
        ("CÔNG KHAI TÀI CHÍNH", 8, 0, 2, 5),
        ("Số lượng cộng nhập", 0, 1, 1, 4),
        ("Thành tiền cộng nhập", 1, 1, 1, 4),
        ("Số lượng xuất ăn", 2, 1, 1, 4),
        ("Thành tiền xuất ăn", 3, 1, 1, 4),
        ("Số lượng xuất khác", 4, 1, 1, 4),
        ("Thành tiền xuất khác", 5, 1, 1, 4),
        ("Số lượng cộng xuất", 6, 1, 1, 4),
        ("Thành tiền cộng xuất", 7, 1, 1, 4),
    ]


def header_merge_boxes(side, table_top=FIRST_TOP):
    """(tên, x0, y0, x1, y1) theo mép trên trang. Dùng cho test ô gộp."""
    xs = _xs(LEFT_WIDTHS if side == "left" else RIGHT_WIDTHS)
    bands = []
    cursor = table_top
    for height in HEADER_HS:
        bands.append(cursor)
        cursor += height
    boxes = []
    for name, col, row, span, rows in _header_merges(side):
        y0 = bands[row]
        boxes.append((
            name,
            xs[col],
            y0,
            xs[col + span],
            y0 + sum(HEADER_HS[row:row + rows]),
        ))
    return boxes


def _draw_merge_borders(c, boxes, page_h) -> None:
    seen = set()
    c.setStrokeColor(black)
    c.setLineWidth(THIN)
    for _name, x0, y0, x1, y1 in boxes:
        edges = (
            (x0, y0, x1, y0),
            (x0, y1, x1, y1),
            (x0, y0, x0, y1),
            (x1, y0, x1, y1),
        )
        for x_a, y_a, x_b, y_b in edges:
            key = (round(x_a, 2), round(y_a, 2), round(x_b, 2), round(y_b, 2))
            if key in seen:
                continue
            seen.add(key)
            c.line(x_a, page_h - y_a, x_b, page_h - y_b)


def _draw_header(c, page_h, table_top, xs, side, date_line) -> float:
    bands = []
    cursor = table_top
    for height in HEADER_HS:
        bands.append(cursor)
        cursor += height
    _draw_merge_borders(c, header_merge_boxes(side, table_top), page_h)
    for col, band, span, rows, text, font, nominal in _header_texts(side, date_line):
        x, width = _span(xs, col, span)
        height = sum(HEADER_HS[band:band + rows])
        _text(c, x, bands[band], width, height, text, font, nominal, "center", page_h)
    return table_top + HEADER_H


def _parts(row):
    parts = row.get("parts") if isinstance(row, dict) else None
    if isinstance(parts, dict) and parts.get("count"):
        return parts
    value = str((row or {}).get("value") or "")
    if " x " in value and " = " in value:
        left, rest = value.split(" x ", 1)
        mid, amount = rest.split(" = ", 1)
        return {"count": left.strip(), "price": mid.strip(), "amount": amount.strip()}
    return None


def _finance_kind(row) -> str:
    tone = (row or {}).get("tone") or (row or {}).get("kind") or ""
    if tone:
        return tone
    label = str((row or {}).get("label") or "")
    if label in ("Thu", "Ăn thêm", "Chi", "So sánh"):
        return "heading"
    if label.startswith("Cộng"):
        return "total"
    return "line"


def _draw_finance(c, page_h, top, height, xs, row) -> None:
    if not row:
        return
    x_t, w_t = _span(xs, 8, 1)
    _, w_u = _span(xs, 9, 1)
    kind = _finance_kind(row)
    label = str(row.get("label") or "")
    if kind == "heading":
        _text(c, x_t, top, w_t + w_u, height, label, FONT_BOLD, 12, "center", page_h)
        return
    font = FONT_BOLD if kind == "total" else FONT_REGULAR
    _text(c, x_t, top, w_t, height, label, font, 12, "left", page_h)
    parts = _parts(row)
    if parts and kind != "total":
        size = _size(12)
        c.setFillColor(black)
        c.setFont(FONT_REGULAR, size)
        base = _baseline(top, height, size, page_h)
        x_u = x_t + w_t
        c.drawRightString(x_u + U_COUNT_RIGHT, base, parts["count"])
        c.drawString(x_u + U_X, base, "x")
        c.drawString(x_u + U_PRICE, base, parts["price"])
        c.drawString(x_u + U_EQ, base, "=")
        c.drawRightString(x_u + U_AMOUNT_RIGHT, base, parts["amount"])
        return
    align = "center" if row.get("align") == "center" or label.startswith("- Mức") else "right"
    _text(c, x_t + w_t, top, w_u, height, row.get("value") or "", font, 12, align, page_h)


def _draw_values(c, page_h, top, xs, spec, values, font_for, nominal_for) -> None:
    for index, (key, align, nominal) in enumerate(spec):
        x, width = _span(xs, index, 1)
        _text(
            c, x, top, width, ROW_H,
            (values or {}).get(key, ""),
            font_for(index, nominal),
            nominal_for(index, nominal),
            align,
            page_h,
        )


def _money_values(values, indexes, spec):
    out = {}
    for index in indexes:
        key = spec[index][0]
        out[key] = (values or {}).get(key, "")
    return out


def _watermark(c, page_w, page_h) -> None:
    c.saveState()
    c.setFillColor(Color(0.75, 0.75, 0.75))
    c.setFont(FONT_BOLD, 64)
    c.translate(page_w / 2, page_h / 2)
    c.rotate(35)
    c.drawCentredString(0, 0, "NHÁP")
    c.restoreState()
    c.setFillColor(black)


def _draw_signatures(c, page_h, top, xs, side, book) -> None:
    title_top = top + 15.1
    name_top = title_top + 17.4 + 15.1 * 3
    sigs = book.get("signatures") or {}
    if side == "left":
        slots = [
            (0, 4, "QUẢN LÝ ĐƠN VỊ", sigs.get("quan_ly") or ""),
            (6, 11, "TRỰC BAN", sigs.get("truc_ban") or ""),
        ]
    else:
        slots = [(8, 10, "CHỈ HUY ĐƠN VỊ", sigs.get("chi_huy") or "")]
    for start, end, title, name in slots:
        x, width = xs[start], xs[end] - xs[start]
        _text(c, x, title_top, width, 17.4, title, FONT_BOLD, 14, "center", page_h)
        if str(name).strip():
            _text(c, x, name_top, width, 17.4, name, FONT_BOLD, 14, "center", page_h)


def _draw_side(c, book, day, sheet, side, page_w, page_h, first) -> None:
    if day.get("draft"):
        _watermark(c, page_w, page_h)
    left = side == "left"
    widths = LEFT_WIDTHS if left else RIGHT_WIDTHS
    spec = LEFT_SPEC if left else RIGHT_SPEC
    xs = _xs(widths)
    table_top = FIRST_TOP if first else NEXT_TOP
    if first and not left:
        _text(
            c, xs[0], table_top - 15.1, xs[-1] - xs[0], 15.1,
            "ĐVT: Đồng", FONT_ITALIC, 12, "right", page_h,
        )
    header_bottom = _draw_header(c, page_h, table_top, xs, side, day.get("dateLine") or "")
    rows = [dict(row) for row in (sheet.get("rows") or [])]
    if first and len(rows) < MIN_FIRST_ROWS:
        rows.extend({} for _ in range(MIN_FIRST_ROWS - len(rows)))
    sequence = []
    if sheet.get("carryIn"):
        sequence.append(("carry", "Mang sang", sheet["carryIn"]))
    for index, row in enumerate(rows):
        sequence.append(("data", index, row))
    if sheet.get("carryOut"):
        sequence.append(("carry", "Cộng sang trang", sheet["carryOut"]))
    if sheet.get("showTotal"):
        sequence.append(("total", "Cộng", sheet.get("totals") or {}))
    skip = () if left else (9,)
    body_bottom = header_bottom + ROW_H * len(sequence)
    # Cột chỉ kẻ từ dưới tiêu đề. Trong tiêu đề, đường dọc nằm trên viền ô gộp.
    _vlines(c, xs, header_bottom, body_bottom, page_h, skip)
    cursor = header_bottom
    finance = day.get("financeLines") or []
    for seq_index, item in enumerate(sequence):
        kind = item[0]
        nxt = sequence[seq_index + 1][0] if seq_index + 1 < len(sequence) else ""
        edge = THIN if kind in ("carry", "total") or nxt in ("carry", "total") else HAIR
        _hline(c, xs[0], xs[-1], cursor + ROW_H, page_h, edge)
        if kind == "data":
            index, row = item[1], item[2]
            _draw_values(
                c, page_h, cursor, xs, spec, row,
                lambda _i, _n: FONT_REGULAR,
                lambda _i, n: n,
            )
            if first and not left and index < len(finance):
                _draw_finance(c, page_h, cursor, ROW_H, xs, finance[index])
        else:
            label, values = item[1], item[2]
            money = LEFT_MONEY if left else RIGHT_MONEY
            shown = _money_values(values, money, spec)

            def font_for(index, _nominal, shown=shown, spec=spec, kind=kind):
                if not shown.get(spec[index][0]):
                    return FONT_REGULAR
                return FONT_BOLD if kind == "total" else FONT_BOLD_ITALIC

            def nominal_for(index, nominal, shown=shown, spec=spec, kind=kind):
                if kind == "total" and shown.get(spec[index][0]):
                    return 10
                return nominal

            _draw_values(c, page_h, cursor, xs, spec, shown, font_for, nominal_for)
            if left:
                label_font = FONT_BOLD if kind == "total" else FONT_BOLD_ITALIC
                label_size = 11 if kind == "total" else 12
                label_align = "center" if kind == "total" else "left"
                x, width = _span(xs, 1, 1)
                _text(c, x, cursor, width, ROW_H, label, label_font, label_size, label_align, page_h)
        cursor += ROW_H
    if sheet.get("showSignature"):
        _draw_signatures(c, page_h, cursor, xs, side, book)


def _wrap_runs(runs, width, size) -> list[list[tuple[str, str]]]:
    words = []
    for text, font in runs:
        for word in str(text).split():
            words.append((word, font))
    lines: list[list[tuple[str, str]]] = []
    current: list[tuple[str, str]] = []
    used = 0.0
    for word, font in words:
        piece = stringWidth(word, font, size)
        gap = stringWidth(" ", font, size) if current else 0
        if current and used + gap + piece > width:
            lines.append(current)
            current = [(word, font)]
            used = piece
        else:
            current.append((word, font))
            used += gap + piece
    if current:
        lines.append(current)
    return lines or [[]]


def _draw_justified(c, x, baseline, width, line, size, justify) -> None:
    if not line:
        return
    if len(line) == 1 or not justify:
        cursor = x
        for index, (word, font) in enumerate(line):
            c.setFont(font, size)
            c.drawString(cursor, baseline, word)
            cursor += stringWidth(word + (" " if index + 1 < len(line) else ""), font, size)
        return
    words_w = 0.0
    for word, font in line:
        words_w += stringWidth(word, font, size)
    gap = (width - words_w) / (len(line) - 1)
    cursor = x
    for word, font in line:
        c.setFont(font, size)
        c.drawString(cursor, baseline, word)
        cursor += stringWidth(word, font, size) + gap


def _draw_cover(c, book, page_w, page_h) -> None:
    cover = book.get("cover") or {}
    left = 35 * 72 / 25.4
    right = 15 * 72 / 25.4
    width = page_w - left - right
    size = 14
    commander = cover.get("commanderRankName") or cover.get("commander") or ""
    keeper = cover.get("keeper") or ""
    para_runs = [
        [("Chỉ huy đơn vị: ", FONT_REGULAR), (commander, FONT_BOLD), (" chứng nhận", FONT_REGULAR)],
        [
            ("Giao sổ này cho đồng chí: ", FONT_REGULAR),
            (keeper, FONT_BOLD),
            (
                " – Nhân viên quản lý để làm sổ nhập – xuất lương thực, thực phẩm, "
                "chất đốt, tiền ăn hằng ngày, hằng tháng của bộ đội và công khai trước đơn vị",
                FONT_REGULAR,
            ),
        ],
    ]
    paragraphs = [_wrap_runs(runs, width, size) for runs in para_runs]
    line_h = 17.4
    para_h = sum(len(lines) * line_h + 8 for lines in paragraphs)
    block = para_h + 34 + 16 + 16 + 96
    cursor = (page_h - block) / 2
    c.setFillColor(black)
    for lines in paragraphs:
        for index, line in enumerate(lines):
            baseline = page_h - (cursor + size * 0.8)
            _draw_justified(c, left, baseline, width, line, size, index < len(lines) - 1)
            cursor += line_h
        cursor += 8
    cursor += 26
    col_left = left + 79.7 * 72 / 25.4
    col_w = 80.3 * 72 / 25.4
    _text(c, col_left, cursor, col_w, 16, cover.get("dateLine") or "", FONT_ITALIC, 14 / 0.97, "center", page_h)
    cursor += 16
    _text(c, col_left, cursor, col_w, 16, "CHỈ HUY ĐƠN VỊ", FONT_BOLD, 14 / 0.97, "center", page_h)
    cursor += 96
    _text(c, col_left, cursor, col_w, 16, commander, FONT_BOLD, 14 / 0.97, "center", page_h)
    draft_days = cover.get("draftDays") or []
    if draft_days:
        shown = ", ".join(day[8:10] + "/" + day[5:7] for day in draft_days if len(day) >= 10)
        warning = f"Chưa chốt, trang các ngày sau in NHÁP: {shown}"
        c.setFillColor(Color(0.55, 0.1, 0.1))
        c.setFont(FONT_BOLD, 10)
        c.drawCentredString(page_w / 2, 56, warning)
        c.setFillColor(black)


def _draw_tail(c, tail, page_w, page_h) -> None:
    # Đuôi sổ 9 trang (tịnh kho, công khai I–VII) chưa dựng. Có payload thì giữ một trang móc.
    c.setFont(FONT_BOLD, 14)
    title = str(tail.get("title") or "") if isinstance(tail, dict) else ""
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
        sheets = day.get("sheets") or []
        for index, sheet in enumerate(sheets):
            c.showPage()
            _draw_side(c, book, day, sheet, "left", page_w, page_h, index == 0)
            c.showPage()
            _draw_side(c, book, day, sheet, "right", page_w, page_h, index == 0)
    tail = book.get("tail")
    if tail:
        c.showPage()
        _draw_tail(c, tail, page_w, page_h)
    c.save()
    return buffer.getvalue()


__all__ = ["render_kitchen_ledger_book"]
