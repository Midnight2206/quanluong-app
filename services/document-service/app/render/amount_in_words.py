from __future__ import annotations

from app.render.carry_totals import find_amount_column_key, parse_amount, sum_amount
from app.render.vnd_words import vnd_to_vietnamese_document_line

AMOUNT_IN_WORDS_PREFIX = "Tổng số tiền (Viết bằng chữ): "
SKIP_SCALAR_FIELD_NAMES = frozenset({"tong_tien_bang_chu"})


def should_skip_scalar_field(field_name: str) -> bool:
    key = str(field_name or "").strip().lower()
    return key in SKIP_SCALAR_FIELD_NAMES


def resolve_document_amount(fields, rows, columns) -> float | None:
    payload = fields if isinstance(fields, dict) else {}
    for key in ("tong_tien", "tong_tien_so"):
        if key not in payload:
            continue
        raw = payload.get(key)
        if raw is None or str(raw).strip() == "":
            continue
        return parse_amount(raw)
    amount_key = find_amount_column_key(columns)
    if not amount_key:
        return None
    if not rows:
        return None
    return sum_amount(rows, amount_key)


def format_amount_in_words_line(amount: float) -> str:
    words = vnd_to_vietnamese_document_line(amount)
    if not words:
        return ""
    return f"{AMOUNT_IN_WORDS_PREFIX}{words}"
