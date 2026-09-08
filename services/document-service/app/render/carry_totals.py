from __future__ import annotations

import re

_AMOUNT_KEYS = ("thanh_tien", "thanh_tien_vnd", "tong_tien", "so_tien")


def try_parse_amount(value) -> float | None:
    """Like parse_amount but returns None when the value is empty or unparseable."""
    raw = str(value or "").strip().replace(" ", "").replace("\u00a0", "")
    if not raw:
        return None
    if re.fullmatch(r"-?\d+", raw):
        return float(raw)
    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            cleaned = raw.replace(".", "").replace(",", ".")
        else:
            cleaned = raw.replace(",", "")
    elif raw.count(".") > 1:
        cleaned = raw.replace(".", "")
    elif raw.count(",") > 1:
        cleaned = raw.replace(",", "")
    elif "," in raw:
        left, _, right = raw.partition(",")
        cleaned = f"{left}.{right}" if len(right) <= 2 else raw.replace(",", "")
    elif "." in raw:
        left, _, right = raw.partition(".")
        # VN: một dấu chấm + đúng 3 chữ số = phân cách hàng nghìn (95.000).
        if left.lstrip("-").isdigit() and right.isdigit() and len(right) == 3:
            cleaned = left + right
        else:
            cleaned = raw
    else:
        cleaned = raw
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_amount(value) -> float:
    return try_parse_amount(value) or 0.0


def format_amount(value: float) -> str:
    """VN: chấm nghìn, phẩy thập phân. VND thường nguyên; vẫn hỗ trợ lẻ."""
    number = float(value or 0)
    if abs(number - round(number)) < 1e-9:
        return f"{int(round(number)):,}".replace(",", ".")
    sign = "-" if number < 0 else ""
    abs_n = abs(number)
    # tối đa 6 chữ số thập phân, bỏ zero thừa
    frac = f"{abs_n:.6f}".rstrip("0").rstrip(".")
    if "." not in frac:
        return f"{sign}{int(frac):,}".replace(",", ".")
    whole, dec = frac.split(".", 1)
    whole_fmt = f"{int(whole):,}".replace(",", ".")
    return f"{sign}{whole_fmt},{dec}"


def find_amount_column_key(columns) -> str | None:
    if not columns:
        return None
    keys = [getattr(col, "key", None) for col in columns]
    for candidate in _AMOUNT_KEYS:
        if candidate in keys:
            return candidate
    for col in reversed(list(columns)):
        if getattr(col, "align", None) == "right" or getattr(col, "align_h", None) == "right":
            return col.key
    return columns[-1].key


def sum_amount(rows: list[dict], amount_key: str | None) -> float:
    if not amount_key:
        return 0.0
    return sum(parse_amount(row.get(amount_key)) for row in rows)


def build_carry_row_values(
    columns,
    *,
    label: str,
    amount: float,
    amount_key: str | None,
) -> dict[str, str]:
    values = {col.key: "" for col in columns}
    if not columns:
        return values
    # Nhãn vào cột nội dung (thường cột 2), không nhét vào STT hẹp.
    non_amount = [col for col in columns if col.key != amount_key]
    if len(non_amount) > 1:
        label_key = non_amount[1].key
    elif non_amount:
        label_key = non_amount[0].key
    else:
        label_key = columns[0].key
    values[label_key] = label
    if amount_key:
        values[amount_key] = format_amount(amount)
    return values


__all__ = [
    "build_carry_row_values",
    "find_amount_column_key",
    "format_amount",
    "parse_amount",
    "sum_amount",
    "try_parse_amount",
]
