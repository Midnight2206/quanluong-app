"""Hoá đơn hằng ngày NCC — A4 gần mẫu hoá đơn điện tử (logo Midnight, chữ ký)."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas

from app.render.fonts import FONT_BOLD, FONT_ITALIC, FONT_REGULAR
from app.render.vnd_words import vnd_to_vietnamese_document_line

PAGE_W, PAGE_H = A4
MARGIN_X = 32
TOP = 36
NOTE = "Hoá đơn đã bao gồm thuế GTGT"
INK = HexColor("#0f2744")
LINE = HexColor("#2f6fed")
MUTED = HexColor("#4b5b70")
LOGO_PATH = Path(__file__).resolve().parents[2] / "assets" / "branding" / "logo-mark.png"


def _text(value) -> str:
    return "" if value is None else str(value).strip()


def _money(value) -> str:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return "—"
    whole = int(round(n))
    return f"{whole:,}".replace(",", ".")


def _long_date(iso: str) -> str:
    parts = _text(iso).split("-")
    if len(parts) != 3:
        return ""
    year, month, day = parts
    try:
        return f"Ngày {int(day)} tháng {int(month)} năm {year}"
    except ValueError:
        return ""


def _faint_logo_reader(path: Path, alpha: float = 0.12) -> ImageReader | None:
    try:
        from PIL import Image
    except ImportError:
        return ImageReader(str(path)) if path.is_file() else None
    if not path.is_file():
        return None
    img = Image.open(path).convert("RGBA")
    r, g, b, a = img.split()
    a = a.point(lambda p: int(p * alpha))
    img = Image.merge("RGBA", (r, g, b, a))
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def _draw_watermark(c: Canvas) -> None:
    c.saveState()
    mark = _faint_logo_reader(LOGO_PATH, 0.11)
    if mark is not None:
        size = 320
        x = (PAGE_W - size) / 2
        y = (PAGE_H - size) / 2 - 20
        c.drawImage(mark, x, y, width=size, height=size, mask="auto", preserveAspectRatio=True)
    else:
        c.setFillColor(Color(0.55, 0.65, 0.85, alpha=0.12))
        c.setFont(FONT_BOLD, 72)
        c.translate(PAGE_W / 2, PAGE_H / 2)
        c.rotate(28)
        c.drawCentredString(0, 0, "MIDNIGHT")
    c.restoreState()


def _draw_border(c: Canvas) -> None:
    c.setStrokeColor(LINE)
    c.setLineWidth(1.6)
    c.roundRect(18, 18, PAGE_W - 36, PAGE_H - 36, 8, stroke=1, fill=0)
    c.setLineWidth(0.6)
    c.roundRect(24, 24, PAGE_W - 48, PAGE_H - 48, 6, stroke=1, fill=0)


def _field_line(c: Canvas, x: float, y: float, label: str, value: str, width: float) -> None:
    c.setFont(FONT_REGULAR, 9)
    c.setFillColor(MUTED)
    c.drawString(x, y, f"{label}:")
    label_w = c.stringWidth(f"{label}: ", FONT_REGULAR, 9)
    c.setFillColor(INK)
    c.drawString(x + label_w, y, value or "………………………………")
    c.setStrokeColor(Color(0.75, 0.8, 0.88))
    c.setLineWidth(0.4)
    c.line(x + label_w, y - 2, x + width, y - 2)


def render_supplier_daily_invoice(payload: dict) -> bytes:
    seller = payload.get("seller") or {}
    buyer = payload.get("buyer") or {}
    lines = payload.get("lines") or []
    date = _text(payload.get("date"))
    note = _text(payload.get("note")) or NOTE
    grand_total = payload.get("grandTotal")
    words = vnd_to_vietnamese_document_line(grand_total) or "—"

    buf = BytesIO()
    c = Canvas(buf, pagesize=A4)
    _draw_border(c)
    _draw_watermark(c)

    y = PAGE_H - TOP - 8

    # Header: logo + seller meta | title | serial placeholders
    logo_size = 42
    if LOGO_PATH.is_file():
        c.drawImage(
            ImageReader(str(LOGO_PATH)),
            MARGIN_X,
            y - logo_size + 8,
            width=logo_size,
            height=logo_size,
            mask="auto",
            preserveAspectRatio=True,
        )
        seller_x = MARGIN_X + logo_size + 10
    else:
        c.setFillColor(LINE)
        c.setFont(FONT_BOLD, 11)
        c.drawString(MARGIN_X, y, "MIDNIGHT")
        seller_x = MARGIN_X + 70

    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 10)
    c.drawString(seller_x, y, _text(seller.get("name")) or "Nhà cung cấp")
    y_meta = y - 12
    c.setFont(FONT_REGULAR, 8)
    c.setFillColor(MUTED)
    for label, key in (
        ("MST", "taxCode"),
        ("Địa chỉ", "address"),
        ("Điện thoại", "phone"),
        ("Email", "email"),
    ):
        val = _text(seller.get(key))
        if not val:
            continue
        c.drawString(seller_x, y_meta, f"{label}: {val}")
        y_meta -= 11

    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 15)
    c.drawCentredString(PAGE_W / 2, y - 6, "HOÁ ĐƠN ĐIỆN TỬ")
    c.setFont(FONT_ITALIC, 10)
    c.setFillColor(MUTED)
    c.drawCentredString(PAGE_W / 2, y - 22, _long_date(date))

    c.setFillColor(INK)
    c.setFont(FONT_REGULAR, 9)
    c.drawRightString(PAGE_W - MARGIN_X, y, "Ký hiệu: …")
    c.drawRightString(PAGE_W - MARGIN_X, y - 12, "Số: …")

    y = min(y_meta, y - 36) - 8
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)
    y -= 18

    # Buyer block
    c.setFillColor(INK)
    _field_line(c, MARGIN_X, y, "Họ tên người mua hàng", "", 280)
    y -= 14
    _field_line(c, MARGIN_X, y, "Tên đơn vị", _text(buyer.get("name")), PAGE_W - 2 * MARGIN_X - 20)
    y -= 14
    _field_line(c, MARGIN_X, y, "Địa chỉ", "", PAGE_W - 2 * MARGIN_X - 20)
    y -= 14
    c.setFont(FONT_REGULAR, 9)
    c.setFillColor(MUTED)
    c.drawString(MARGIN_X, y, "Hình thức thanh toán: …")
    c.drawString(MARGIN_X + 210, y, "Đồng tiền: VND")
    y -= 18

    # Table — cạnh cột + lưới đầy đủ
    xs = [
        MARGIN_X,
        MARGIN_X + 28,
        MARGIN_X + 232,
        MARGIN_X + 278,
        MARGIN_X + 330,
        MARGIN_X + 408,
        PAGE_W - MARGIN_X,
    ]
    headers = ["STT", "Tên hàng hoá, dịch vụ", "ĐVT", "Số lượng", "Đơn giá", "Thành tiền"]
    header_h = 16
    row_h = 14
    pad_x = 3
    table_w = xs[-1] - xs[0]

    def draw_header_row(top: float) -> float:
        c.setFillColor(HexColor("#eaf1ff"))
        c.rect(xs[0], top - header_h, table_w, header_h, stroke=0, fill=1)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 8)
        text_y = top - header_h + 5
        for i, h in enumerate(headers):
            if i >= 3:
                c.drawRightString(xs[i + 1] - pad_x, text_y, h)
            else:
                c.drawString(xs[i] + pad_x, text_y, h)
        return top - header_h

    def stroke_table_grid(top: float, bottom: float, band_ys: list[float]) -> None:
        c.setStrokeColor(LINE)
        c.setLineWidth(0.7)
        c.rect(xs[0], bottom, table_w, top - bottom, stroke=1, fill=0)
        for x in xs[1:-1]:
            c.line(x, bottom, x, top)
        for hy in band_ys:
            c.line(xs[0], hy, xs[-1], hy)

    def draw_body_row(top: float, vals: list[str]) -> float:
        text_y = top - row_h + 4
        c.setFont(FONT_REGULAR, 8)
        c.setFillColor(INK)
        c.drawString(xs[0] + pad_x, text_y, vals[0])
        c.drawString(xs[1] + pad_x, text_y, vals[1][:46])
        c.drawString(xs[2] + pad_x, text_y, vals[2][:8])
        c.drawRightString(xs[4] - pad_x, text_y, vals[3])
        c.drawRightString(xs[5] - pad_x, text_y, vals[4])
        c.drawRightString(xs[6] - pad_x, text_y, vals[5])
        return top - row_h

    table_top = y
    y = draw_header_row(y)
    band_ys = [y]
    body_rows = list(lines) if lines else [None]

    for idx, row in enumerate(body_rows, start=1):
        if y - row_h < 168:
            stroke_table_grid(table_top, y, band_ys)
            c.showPage()
            _draw_border(c)
            _draw_watermark(c)
            y = PAGE_H - TOP
            table_top = y
            y = draw_header_row(y)
            band_ys = [y]
        if row is None:
            c.setFont(FONT_REGULAR, 8)
            c.setFillColor(MUTED)
            c.drawCentredString((xs[0] + xs[-1]) / 2, y - row_h + 4, "Không có dòng trong ngày này.")
            y -= row_h
        else:
            vals = [
                str(idx),
                _text(row.get("name")),
                _text(row.get("measureUnit")) or "—",
                _text(row.get("quantityFormatted") or row.get("quantity")),
                _money(row.get("unitPrice")),
                _money(row.get("amount")),
            ]
            y = draw_body_row(y, vals)
        band_ys.append(y)

    stroke_table_grid(table_top, y, band_ys)
    y -= 14

    c.setFillColor(INK)
    c.setFont(FONT_REGULAR, 9)
    c.drawString(MARGIN_X, y, "Cộng tiền hàng:")
    c.setFont(FONT_BOLD, 9)
    c.drawRightString(PAGE_W - MARGIN_X, y, _money(grand_total))
    y -= 13
    c.setFont(FONT_REGULAR, 9)
    c.drawString(MARGIN_X, y, "Thuế suất GTGT: đã bao gồm")
    c.drawRightString(PAGE_W - MARGIN_X, y, "—")
    y -= 13
    c.setFont(FONT_BOLD, 10)
    c.drawString(MARGIN_X, y, "Tổng cộng tiền thanh toán:")
    c.drawRightString(PAGE_W - MARGIN_X, y, _money(grand_total))
    y -= 16
    c.setFont(FONT_ITALIC, 9)
    c.setFillColor(MUTED)
    c.drawString(MARGIN_X, y, f"Số tiền viết bằng chữ: {words}")
    y -= 14
    c.setFont(FONT_REGULAR, 8)
    c.drawString(MARGIN_X, y, note)

    # Signatures
    y = max(96, min(y - 28, 150))
    mid = PAGE_W / 2
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 10)
    c.drawCentredString(MARGIN_X + (mid - MARGIN_X) / 2, y, "Người mua hàng")
    c.drawCentredString(mid + (PAGE_W - MARGIN_X - mid) / 2, y, "Người bán hàng")
    y -= 12
    c.setFont(FONT_ITALIC, 8)
    c.setFillColor(MUTED)
    c.drawCentredString(MARGIN_X + (mid - MARGIN_X) / 2, y, "(Ký, ghi rõ họ tên)")
    c.drawCentredString(mid + (PAGE_W - MARGIN_X - mid) / 2, y, "(Ký, ghi rõ họ tên)")
    y -= 48
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 9)
    seller_name = _text(seller.get("name"))
    if seller_name:
        c.drawCentredString(mid + (PAGE_W - MARGIN_X - mid) / 2, y, seller_name)
    rep = _text(seller.get("representativeName"))
    if rep:
        c.setFont(FONT_REGULAR, 8)
        c.setFillColor(MUTED)
        c.drawCentredString(mid + (PAGE_W - MARGIN_X - mid) / 2, y - 12, rep)

    c.save()
    return buf.getvalue()
