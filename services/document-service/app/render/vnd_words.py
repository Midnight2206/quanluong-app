from __future__ import annotations

import math

_UNITS = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]


def _read_tens(n: int, force_zero_hundred: bool = False) -> str:
    if n == 0:
        return ""
    if n < 10:
        return f"linh {_UNITS[n]}" if force_zero_hundred else _UNITS[n]
    if n < 20:
        if n == 10:
            return "mười"
        if n == 15:
            return "mười lăm"
        return f"mười {_UNITS[n - 10]}"
    t = n // 10
    u = n % 10
    tens = f"{_UNITS[t]} mươi"
    if u == 0:
        return tens
    if u == 1:
        return f"{tens} mốt"
    if u == 5:
        return f"{tens} lăm"
    return f"{tens} {_UNITS[u]}"


def _read_group(n: int, force_full: bool = False) -> str:
    value = int(n)
    if value <= 0:
        return ""
    hundreds = value // 100
    rest = value % 100
    parts: list[str] = []
    if hundreds > 0:
        parts.append(f"{_UNITS[hundreds]} trăm")
    elif force_full:
        parts.append("không trăm")
    if rest > 0:
        parts.append(_read_tens(rest, hundreds > 0 or force_full))
    return " ".join(parts)


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s


def _parse_input_number(value: float | int | str | None) -> float | None:
    """Coerce to float; None if invalid. str paths mirror JS Number()."""
    if isinstance(value, str):
        s = value.strip()
        if not s or "_" in s:
            return None
        try:
            return float(s)
        except ValueError:
            try:
                return float(int(s, 0))
            except ValueError:
                return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def vnd_to_vietnamese_document_line(value: float | int | str | None) -> str:
    """Đọc số tiền VND thành chữ (một dòng, viết hoa chữ đầu)."""
    n = _parse_input_number(value)
    if n is None:
        return ""
    if not math.isfinite(n) or n < 0:
        return ""
    n = int(math.floor(n + 0.5))  # ponytail: matches JS Math.round for n >= 0
    if n == 0:
        return "Không đồng"
    r = n
    ty = r // 1_000_000_000
    r %= 1_000_000_000
    trieu = r // 1_000_000
    r %= 1_000_000
    nghin = r // 1_000
    don = r % 1000
    high: list[str] = []
    if ty:
        high.append(f"{_read_group(ty)} tỷ")
    if trieu:
        high.append(f"{_read_group(trieu, ty > 0)} triệu")
    if nghin:
        high.append(f"{_read_group(nghin, ty > 0 or trieu > 0)} nghìn")
    high_str = " ".join(high)
    if don > 0:
        low = f"{_read_group(don, len(high) > 0)} đồng"
        return _cap(f"{high_str}, {low}" if high_str else low)
    return _cap(f"{high_str} đồng")
